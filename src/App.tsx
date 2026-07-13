import { StoreProvider } from './state/store';
import { Board } from './Board';

export default function App() {
  return (
    <StoreProvider>
      <Board />
    </StoreProvider>
  );
}
