import { createFileRoute } from '@tanstack/react-router';

import { FileText } from 'lucide-react';

import { AppNavbar } from '@/components/app-navbar';
import { Main } from '@/components/layout/main';
import { TransactionsTable } from '@/features/dashboard/components/transactions-table';

function Transactions() {
  return (
    <>
      <AppNavbar />
      
      <Main>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Conservative Banking Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-8 w-8 text-gray-700 dark:text-gray-300" />
              <h1 className="banking-title">Transaction History</h1>
            </div>
            <p className="banking-subtitle max-w-2xl">
              Review your transaction history and spending patterns. 
              All transactions are recorded and available for your records.
            </p>
          </div>

          {/* Transactions Content */}
          <TransactionsTable />
        </div>
      </Main>
    </>
  );
}

export const Route = createFileRoute('/_authenticated/transactions')({
  component: Transactions,
});