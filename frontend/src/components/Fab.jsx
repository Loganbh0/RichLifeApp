import { Link } from 'react-router-dom';

export default function Fab() {
  return (
    <Link to="/add" className="fab" aria-label="Add transaction">
      +
    </Link>
  );
}
