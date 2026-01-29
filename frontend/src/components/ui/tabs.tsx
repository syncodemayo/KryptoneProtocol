import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsProps {
  children: React.ReactNode;
  defaultValue: string;
  className?: string;
}

const Tabs = ({ children, defaultValue, className }: TabsProps) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue);
  
  return (
    <div className={cn('w-full', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  activeTab?: string;
  setActiveTab?: (val: string) => void;
}

const TabsList = ({ children, className, activeTab, setActiveTab }: TabsListProps) => {
  return (
    <div className={cn('inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
};

interface TabsTriggerProps {
  children: React.ReactNode;
  value: string;
  activeTab?: string;
  setActiveTab?: (val: string) => void;
  className?: string;
}

const TabsTrigger = ({ children, value, activeTab, setActiveTab, className }: TabsTriggerProps) => {
  const isActive = activeTab === value;
  return (
    <button
      onClick={() => setActiveTab?.(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  children: React.ReactNode;
  value: string;
  activeTab?: string;
  className?: string;
}

const TabsContent = ({ children, value, activeTab, className }: TabsContentProps) => {
  if (activeTab !== value) return null;
  return (
    <div className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}>
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
