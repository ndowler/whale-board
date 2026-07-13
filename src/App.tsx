import { AttributionFooter } from './ui/AttributionFooter';
import { MapView } from './map/MapView';

export default function App() {
  return (
    <div className="app">
      <div className="app__main">
        <div className="app__map">
          <MapView />
        </div>
      </div>
      <AttributionFooter />
    </div>
  );
}
