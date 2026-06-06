import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/index.js";

function ConfirmDialog({ open, title, message, confirmLabel, onCancel, onConfirm }) {
  return (
    <Dialog open={open}>
      <DialogBackdrop className="dialog-backdrop">
        <DialogContent className="confirm-dialog" aria-labelledby="confirm-title">
          <DialogHeader>
            <DialogTitle id="confirm-title">{title}</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="dialog-actions">
          <Button className="secondary-button" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button className="submit-button" variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          </DialogFooter>
        </DialogContent>
      </DialogBackdrop>
    </Dialog>
  )
}

export default ConfirmDialog
