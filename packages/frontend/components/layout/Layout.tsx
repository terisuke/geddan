import { Header } from './Header';
import { Footer } from './Footer';
import { ErrorProvider } from '@/components/providers/ErrorProvider';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <ErrorProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ErrorProvider>
  );
}

