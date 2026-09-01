import ServerReviewInbox from './ServerReviewInbox.jsx';
import { productionReviewApi } from './lib/serverReviewApi.js';

export default function StudioReviewInbox({ onSessionExpired, workStore, onDirtyChange, onBusyChange }) {
  return (
    <ServerReviewInbox
      client={productionReviewApi}
      embedded
      onSessionExpired={onSessionExpired}
      workStore={workStore}
      onDirtyChange={onDirtyChange}
      onBusyChange={onBusyChange}
    />
  );
}
