"""AST-based feature suppression for CadQuery scripts.

Given a CadQuery script where operations are tagged with .tag("name"),
this module can remove specific operations by tag name and resolve
dependency chains so that child features are automatically suppressed
when their parent is suppressed.
"""
import ast
import logging

logger = logging.getLogger(__name__)


class FeatureSuppressor(ast.NodeTransformer):
    """Remove CadQuery operations from the AST by their .tag() name."""

    def __init__(self, suppressed_tags: set):
        self.suppressed_tags = suppressed_tags

    def _find_tag(self, node) -> str | None:
        """Recursively search an AST node for a .tag("name") call."""
        if isinstance(node, ast.Call):
            if (isinstance(node.func, ast.Attribute)
                    and node.func.attr == 'tag'
                    and node.args
                    and isinstance(node.args[0], ast.Constant)):
                return node.args[0].value
            # Check nested chains: .hole(...).tag("name")
            if isinstance(node.func, ast.Attribute) and hasattr(node.func, 'value'):
                return self._find_tag(node.func.value)
            # Check the function's value for deeper nesting
            if hasattr(node, 'func') and hasattr(node.func, 'value'):
                found = self._find_tag(node.func.value)
                if found:
                    return found
        return None

    def _should_suppress(self, node) -> bool:
        """Check if an assignment node contains a suppressed tag."""
        if isinstance(node, ast.Assign) and node.value:
            tag = self._find_tag(node.value)
            return tag is not None and tag in self.suppressed_tags
        return False

    def _is_suppressed_append(self, node) -> bool:
        """Check if an _features.append() call contains a suppressed tag."""
        if not (isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)):
            return False
        call = node.value
        if not (isinstance(call.func, ast.Attribute) and call.func.attr == 'append'):
            return False
        # Check if the dict arg has "tag" matching a suppressed tag
        for arg in call.args:
            if isinstance(arg, ast.Dict):
                for k, v in zip(arg.keys, arg.values):
                    if (isinstance(k, ast.Constant) and k.value == 'tag'
                            and isinstance(v, ast.Constant)
                            and v.value in self.suppressed_tags):
                        return True
        return False

    def _is_suppressed_step_increment(self, node, next_node=None) -> bool:
        """Check if a _step += 1 precedes a suppressed operation."""
        # We handle this at the Module level instead
        return False

    def visit_Module(self, node):
        """Process the module body, removing suppressed operations and their associated statements."""
        new_body = []
        i = 0
        while i < len(node.body):
            stmt = node.body[i]

            # Check if this is a suppressed assignment (result = ...)
            if self._should_suppress(stmt):
                # Skip this statement and any following _features.append for the same tag
                i += 1
                # Also skip the _step increment that precedes it (look back)
                if (new_body and isinstance(new_body[-1], ast.AugAssign)
                        and isinstance(new_body[-1].target, ast.Name)
                        and new_body[-1].target.id == '_step'):
                    new_body.pop()
                # Skip following _features.append()
                while i < len(node.body) and self._is_suppressed_append(node.body[i]):
                    i += 1
                continue

            # Check if this is a try/except containing a suppressed operation
            if isinstance(stmt, ast.Try):
                has_suppressed = False
                for body_stmt in stmt.body:
                    if isinstance(body_stmt, ast.Assign) and self._should_suppress(body_stmt):
                        has_suppressed = True
                        break
                if has_suppressed:
                    # Remove preceding _step increment
                    if (new_body and isinstance(new_body[-1], ast.AugAssign)
                            and isinstance(new_body[-1].target, ast.Name)
                            and new_body[-1].target.id == '_step'):
                        new_body.pop()
                    i += 1
                    # Skip following _features.append()
                    while i < len(node.body) and self._is_suppressed_append(node.body[i]):
                        i += 1
                    continue

            # Check if this is a _features.append for a suppressed tag (standalone)
            if self._is_suppressed_append(stmt):
                i += 1
                continue

            new_body.append(stmt)
            i += 1

        node.body = new_body
        return node


def suppress_features(script: str, tags_to_suppress: set) -> str:
    """Remove tagged operations from a CadQuery script.

    Args:
        script: The full CadQuery Python script.
        tags_to_suppress: Set of tag names to remove.

    Returns:
        Modified script with the tagged operations removed.
    """
    try:
        tree = ast.parse(script)
        transformer = FeatureSuppressor(tags_to_suppress)
        modified = transformer.visit(tree)
        ast.fix_missing_locations(modified)
        return ast.unparse(modified)
    except SyntaxError as e:
        logger.error(f"Failed to parse script for suppression: {e}")
        return script  # Return original on failure


def resolve_dependencies(features: list, tags_to_suppress: set) -> set:
    """Compute transitive closure of suppression.

    If feature A is suppressed and feature B depends on A,
    then B is also suppressed (cascading).

    Args:
        features: List of feature dicts with 'tag' and 'depends_on' fields.
        tags_to_suppress: Initial set of tags to suppress.

    Returns:
        Complete set of tags that should be suppressed (including cascaded).
    """
    all_suppressed = set(tags_to_suppress)
    changed = True
    while changed:
        changed = False
        for f in features:
            tag = f.get("tag", "")
            if tag not in all_suppressed:
                deps = f.get("depends_on", [])
                if any(d in all_suppressed for d in deps):
                    all_suppressed.add(tag)
                    changed = True
    return all_suppressed
