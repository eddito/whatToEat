export function getMixedScore(teamScore: number, externalScore = 0, externalCount = 0) {
  const externalWeight = Math.min(externalCount / 5, 1) * 0.3;
  const teamWeight = 1 - externalWeight;
  const mixed = teamScore * teamWeight + externalScore * externalWeight;

  return Number(mixed.toFixed(1));
}
