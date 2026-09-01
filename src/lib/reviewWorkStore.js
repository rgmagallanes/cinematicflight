export function clearOwnerReviewWork(workStore, ownerId) {
  if (!workStore?.current || ownerId === null || ownerId === undefined) return;
  const prefix = `${ownerId}:`;
  for (const key of Object.keys(workStore.current)) {
    if (key.startsWith(prefix)) delete workStore.current[key];
  }
}
