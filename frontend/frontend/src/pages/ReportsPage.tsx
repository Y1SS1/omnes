import { PageTitle } from "../components/ui";
import { PlannedBudgetReports } from "../components/PlannedBudgetReports";

export default function ReportsPage() {
  return (
    <div>
      <PageTitle title="Reportes y métricas" subtitle="Cómo va el presupuesto que tienes en ejecución." />
      <PlannedBudgetReports />
    </div>
  );
}
