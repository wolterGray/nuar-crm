import styles from './Card.module.css';

/**
 * Premium dark UI Card component.
 * Accepts any additional props (e.g., data-tone) and merges class names.
 */
export default function Card({
  className = '',
  children,
  ...props
}) {
  const cls = `${styles.card} ${className}`.trim();
  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}
