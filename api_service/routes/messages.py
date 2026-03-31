"""Messaging endpoints — claim-scoped conversations between buyers and fulfillers."""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, selectinload

from dependencies import get_db, get_redis, get_current_user
from cache import cache_invalidate
from events import publish_event
from rate_limit import limiter

from fitd_schemas.fitd_db_schemas import (
    User, Order, Claim, Conversation, Message, ConversationReadPosition,
)
from fitd_schemas.fitd_classes import (
    MessageCreate, MessageResponse, ConversationResponse, UnreadCountResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_claim_and_verify_participant(claim_id: str, user: User, db: Session):
    """Load a claim with its order and verify the user is buyer or fulfiller."""
    claim = db.query(Claim).options(selectinload(Claim.order)).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    order = claim.order
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for claim")
    if user.user_id not in (claim.claimant_user_id, order.user_id):
        raise HTTPException(status_code=403, detail="Not a participant in this claim")
    return claim, order


def _get_or_create_conversation(claim: Claim, order: Order, db: Session) -> Conversation:
    """Get existing conversation for a claim, or create one."""
    conversation = db.query(Conversation).filter(Conversation.claim_id == claim.id).first()
    if conversation:
        return conversation

    conversation = Conversation(
        claim_id=claim.id,
        buyer_user_id=order.user_id,
        fulfiller_user_id=claim.claimant_user_id,
    )
    db.add(conversation)
    db.flush()

    # Create read positions for both participants
    for uid in (order.user_id, claim.claimant_user_id):
        db.add(ConversationReadPosition(conversation_id=conversation.id, user_id=uid))
    db.flush()

    return conversation


def _get_recipient_id(user: User, conversation: Conversation) -> str:
    """Return the other participant's user_id."""
    if user.user_id == conversation.buyer_user_id:
        return conversation.fulfiller_user_id
    return conversation.buyer_user_id


@router.post("/claims/{claim_id}/messages", status_code=201, response_model=MessageResponse)
@limiter.limit("20/minute")
def send_message(
    request: Request,
    claim_id: str,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    redis_client=Depends(get_redis),
):
    claim, order = _get_claim_and_verify_participant(claim_id, user, db)
    conversation = _get_or_create_conversation(claim, order, db)

    message = Message(
        conversation_id=conversation.id,
        sender_user_id=user.user_id,
        body=payload.body,
    )
    db.add(message)
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(message)

    recipient_id = _get_recipient_id(user, conversation)
    cache_invalidate(redis_client, f"fitd:unread:{recipient_id}")
    publish_event(redis_client, "message:received", user_id=recipient_id, data={"claim_id": claim_id})

    return MessageResponse.from_orm(message)


@router.get("/claims/{claim_id}/messages", response_model=list[MessageResponse])
def get_messages(
    claim_id: str,
    before: Optional[str] = Query(None, description="Cursor: message ID to fetch before"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    claim, order = _get_claim_and_verify_participant(claim_id, user, db)
    conversation = db.query(Conversation).filter(Conversation.claim_id == claim.id).first()
    if not conversation:
        return []

    query = db.query(Message).filter(Message.conversation_id == conversation.id)

    if before:
        cursor_msg = db.query(Message).filter(Message.id == before).first()
        if cursor_msg:
            query = query.filter(Message.created_at < cursor_msg.created_at)

    messages = query.order_by(Message.created_at.desc()).limit(limit).all()
    messages.reverse()  # Return in chronological order

    return [MessageResponse.from_orm(m) for m in messages]


@router.patch("/claims/{claim_id}/messages/read")
def mark_messages_read(
    claim_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    redis_client=Depends(get_redis),
):
    claim, order = _get_claim_and_verify_participant(claim_id, user, db)
    conversation = db.query(Conversation).filter(Conversation.claim_id == claim.id).first()
    if not conversation:
        return {"message": "No conversation to mark read"}

    # Get the latest message in this conversation
    latest_message = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at.desc()).first()

    if not latest_message:
        return {"message": "No messages to mark read"}

    read_pos = db.query(ConversationReadPosition).filter(
        ConversationReadPosition.conversation_id == conversation.id,
        ConversationReadPosition.user_id == user.user_id,
    ).first()

    if read_pos:
        read_pos.last_read_message_id = latest_message.id
        read_pos.last_read_at = datetime.utcnow()
    else:
        db.add(ConversationReadPosition(
            conversation_id=conversation.id,
            user_id=user.user_id,
            last_read_message_id=latest_message.id,
            last_read_at=datetime.utcnow(),
        ))

    db.commit()

    cache_invalidate(redis_client, f"fitd:unread:{user.user_id}")
    recipient_id = _get_recipient_id(user, conversation)
    publish_event(redis_client, "message:read", user_id=recipient_id, data={"claim_id": claim_id})

    return {"message": "Messages marked as read"}


@router.get("/conversations", response_model=list[ConversationResponse])
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversations = db.query(Conversation).filter(
        or_(
            Conversation.buyer_user_id == user.user_id,
            Conversation.fulfiller_user_id == user.user_id,
        )
    ).order_by(Conversation.updated_at.desc()).all()

    results = []
    for conv in conversations:
        # Get last message
        last_msg = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at.desc()).first()

        # Get unread count
        read_pos = db.query(ConversationReadPosition).filter(
            ConversationReadPosition.conversation_id == conv.id,
            ConversationReadPosition.user_id == user.user_id,
        ).first()

        unread_query = db.query(func.count(Message.id)).filter(
            Message.conversation_id == conv.id,
            Message.sender_user_id != user.user_id,
        )
        if read_pos and read_pos.last_read_message_id:
            read_msg = db.query(Message).filter(Message.id == read_pos.last_read_message_id).first()
            if read_msg:
                unread_query = unread_query.filter(Message.created_at > read_msg.created_at)
        unread_count = unread_query.scalar() or 0

        results.append(ConversationResponse(
            id=conv.id,
            claim_id=conv.claim_id,
            buyer_user_id=conv.buyer_user_id,
            fulfiller_user_id=conv.fulfiller_user_id,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            last_message=MessageResponse.from_orm(last_msg) if last_msg else None,
            unread_count=unread_count,
        ))

    return results


@router.get("/messages/unread_count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversations = db.query(Conversation).filter(
        or_(
            Conversation.buyer_user_id == user.user_id,
            Conversation.fulfiller_user_id == user.user_id,
        )
    ).all()

    total = 0
    for conv in conversations:
        read_pos = db.query(ConversationReadPosition).filter(
            ConversationReadPosition.conversation_id == conv.id,
            ConversationReadPosition.user_id == user.user_id,
        ).first()

        unread_query = db.query(func.count(Message.id)).filter(
            Message.conversation_id == conv.id,
            Message.sender_user_id != user.user_id,
        )
        if read_pos and read_pos.last_read_message_id:
            read_msg = db.query(Message).filter(Message.id == read_pos.last_read_message_id).first()
            if read_msg:
                unread_query = unread_query.filter(Message.created_at > read_msg.created_at)
        total += unread_query.scalar() or 0

    return UnreadCountResponse(total_unread=total)
