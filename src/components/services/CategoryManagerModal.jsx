import {useState} from "react";
import AppIcon from "../ui/AppIcon.jsx";
import {getCategoryColor} from "../../utils/serviceColors.js";

export default function CategoryManagerModal({
  isOpen,
  categories = [],
  categoryCounts = new Map(),
  onClose,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}) {
  const [newCatName, setNewCatName] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setError("Категория с таким названием уже существует");
      return;
    }
    setError("");
    onCreateCategory?.(trimmed);
    setNewCatName("");
  };

  const startRename = (cat) => {
    setEditingCategory(cat);
    setEditingName(cat);
    setError("");
  };

  const handleSaveRename = (cat) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === cat) {
      setEditingCategory(null);
      return;
    }
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase() && c.toLowerCase() !== cat.toLowerCase())) {
      setError("Категория с таким названием уже существует");
      return;
    }
    setError("");
    onRenameCategory?.(cat, trimmed);
    setEditingCategory(null);
  };

  const handleDelete = (cat) => {
    const count = categoryCounts.get(cat) ?? 0;
    if (count > 0) {
      const ok = window.confirm(
        `В категории "${cat}" находится ${count} услуг. При удалении они будут перемещены в "Без категории". Продолжить?`,
      );
      if (!ok) return;
    }
    onDeleteCategory?.(cat);
  };

  return (
    <div className="crm-modal-overlay services-modal-overlay" onClick={onClose}>
      <div
        className="services-cat-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-modal-title">
        {/* Modal Header */}
        <div className="services-cat-modal-header">
          <div className="services-cat-modal-title-wrap">
            <h2 id="cat-modal-title">Управление категориями</h2>
            <span className="services-cat-modal-subtitle">
              {categories.length} категорий в каталоге
            </span>
          </div>
          <button
            className="services-modal-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Закрыть">
            <AppIcon name="close" size="sm" />
          </button>
        </div>

        {error ? <div className="services-cat-modal-error">{error}</div> : null}

        {/* Categories List */}
        <div className="services-cat-list">
          {categories.map((cat) => {
            const count = categoryCounts.get(cat) ?? 0;
            const color = getCategoryColor(cat);
            const isEditing = editingCategory === cat;

            return (
              <div key={cat} className="services-cat-item">
                <div className="services-cat-item-drag" title="Переместить">
                  <AppIcon name="grip" size="xs" />
                </div>
                <span
                  className="services-cat-color-dot"
                  style={{backgroundColor: color}}
                  aria-hidden="true"
                />

                {isEditing ? (
                  <div className="services-cat-edit-inline">
                    <input
                      autoFocus
                      className="services-cat-input-inline"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(cat);
                        if (e.key === "Escape") setEditingCategory(null);
                      }}
                    />
                    <button
                      className="services-cat-btn-save"
                      type="button"
                      onClick={() => handleSaveRename(cat)}>
                      Сохранить
                    </button>
                    <button
                      className="services-cat-btn-cancel"
                      type="button"
                      onClick={() => setEditingCategory(null)}>
                      Отмена
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="services-cat-name">{cat}</span>
                    <span className="services-cat-count-badge" title="Услуг в категории">
                      {count}
                    </span>

                    <div className="services-cat-item-actions">
                      <button
                        className="services-cat-action-btn"
                        type="button"
                        onClick={() => startRename(cat)}
                        title="Переименовать категорию">
                        <AppIcon name="edit" size="xs" />
                      </button>
                      <button
                        className="services-cat-action-btn services-cat-action-delete"
                        type="button"
                        onClick={() => handleDelete(cat)}
                        title="Удалить категорию">
                        <AppIcon name="trash" size="xs" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Category Form */}
        <form className="services-cat-add-form" onSubmit={handleCreate}>
          <input
            className="services-cat-add-input"
            placeholder="Название новой категории..."
            value={newCatName}
            onChange={(e) => {
              setNewCatName(e.target.value);
              setError("");
            }}
          />
          <button
            className="services-cat-add-btn"
            type="submit"
            disabled={!newCatName.trim()}>
            <AppIcon name="plus" size="xs" />
            Добавить категорию
          </button>
        </form>

        {/* Modal Footer */}
        <div className="services-cat-modal-footer">
          <button
            className="services-cat-footer-close-btn"
            type="button"
            onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
