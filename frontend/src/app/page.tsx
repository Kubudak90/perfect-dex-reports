import { redirect } from 'next/navigation';

/**
 * Home page - redirects to swap page
 */
export default function HomePage() {
  redirect('/swap');
}
