import { CONFIG } from '../config';

export function AttributionFooter() {
  return (
    <footer className="footer">
      <span className="footer__attribution">{CONFIG.attribution}</span>
      <span className="footer__disclaimer">{CONFIG.disclaimer}</span>
    </footer>
  );
}
