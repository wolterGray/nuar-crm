import {AppIcon, Button, Card} from "./ui/index.js";

export default function ForbiddenScreen({
  pageName = "данному разделу",
  onNavigate,
}) {
  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6 select-none">
      <Card className="max-w-md w-full p-8 flex flex-col items-center text-center gap-4 bg-surface/90 border border-border rounded-card shadow-xl">
        <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center">
          <AppIcon name="shield" size="xl" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-bold text-text-main m-0">
            Доступ ограничен
          </h1>
          <p className="text-xs text-text-muted leading-relaxed m-0">
            У вашей учётной записи нет прав для просмотра {pageName}.
            Обратитесь к администратору студии для расширения прав доступа.
          </p>
        </div>

        {onNavigate && (
          <Button
            className="mt-2 w-full"
            leftIcon="arrowLeft"
            size="md"
            variant="primary"
            onClick={onNavigate}
          >
            Вернуться в рабочий раздел
          </Button>
        )}
      </Card>
    </main>
  );
}
