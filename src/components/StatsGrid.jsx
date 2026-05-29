function StatsGrid({stats}) {
  return (
    <section className="stats-grid">
      {stats.map((card) => {
        const Icon = card.icon;
        return (
          <article className="stat-card" key={card.title}>
            <div className="stat-icon">
              <Icon size={25} />
            </div>
            <div>
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
          </article>
        );
      })}
    </section>
  );
}
export default StatsGrid