import ToolPage from "./pages/ToolPage.jsx";

// localStorage mode: skip auth entirely, go straight to the tool
export default function App() {
  return <ToolPage userRole="licensor" />;
}
