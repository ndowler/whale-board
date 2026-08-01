import { CONFIG } from '../config';

export function AttributionFooter() {
  return (
    <footer className="footer">
      <span className="footer__full">
        <span className="footer__attribution">{CONFIG.attribution}</span>
        <span className="footer__disclaimer">{CONFIG.disclaimer}</span>
      </span>
      <span className="footer__compact">{CONFIG.attributionCompact}</span>
    </footer>
  );
}
