import { PageTitle } from "../components/ui";
import { PlannedBudgetReports } from "../components/PlannedBudgetReports";

export default function ReportsPage() {
  return (
    <div>
      <PageTitle title="Reportes y métricas" subtitle="Compara los montos estimados de tus presupuestos con los precios de mercado que encontró la IA." />
      <PlannedBudgetReports />
    </div>
  );
}
