const fallbackVersion = "dev-local";
const shortCommitLength = 7;

function formatDeployedAt(rawValue?: string): string | null {
  if (!rawValue) {
    return null;
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsedDate);
}

export const buildInfo = {
  version: import.meta.env.VITE_APP_VERSION || fallbackVersion,
  shortCommitSha: import.meta.env.VITE_APP_COMMIT_SHA?.slice(0, shortCommitLength) ?? null,
  deployedAt: formatDeployedAt(import.meta.env.VITE_APP_DEPLOYED_AT),
};
