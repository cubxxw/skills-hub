/**
 * Main App Component
 * Root component with AG-UI Provider and routing
 */

import { useState } from 'react';
import { AGUIProvider } from './providers/AGUIProvider';
import { SkillsList } from './pages/SkillsList';
import { SkillDetail } from './pages/SkillDetail';
import './App.css';

function App(): JSX.Element {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const handleSkillSelect = (skillId: string): void => {
    setSelectedSkillId(skillId);
  };

  const handleBack = (): void => {
    setSelectedSkillId(null);
  };

  return (
    <AGUIProvider wsUrl="ws://localhost:4000/ag-ui">
      <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden">
        {selectedSkillId ? (
          <SkillDetail skillId={selectedSkillId} onBack={handleBack} />
        ) : (
          <SkillsList onSkillSelect={handleSkillSelect} />
        )}
      </div>
    </AGUIProvider>
  );
}

export default App;
