import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { BasketInformation } from '../../app/utility/interfaces';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDeleteBasketItemMutation } from '../../services/dbApi';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { useSnackbar } from '../shared/useSnackbar';

function DeleteFromBasket({ item }: { item: BasketInformation }) {
  const [deleteBasketItem] = useDeleteBasketItemMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { snackbar, showSuccess, showError, close } = useSnackbar();

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    try {
      await deleteBasketItem(item.task_id);
      showSuccess(`"${item.name}" removed from basket`);
      setConfirmOpen(false);
    } catch {
      showError('Failed to remove item from basket');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setConfirmOpen(true)}>
        <DeleteIcon />
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Remove Item"
        message={`Are you sure you want to remove "${item.name}" from your basket?`}
        confirmLabel="Remove"
        severity="error"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={close} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default DeleteFromBasket;
