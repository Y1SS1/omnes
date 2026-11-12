import { PageTitle } from "../components/ui";
import { PlannedBudget } from "../components/PlannedBudget";

// The wallet holds the budget the user is executing: Omnes plans and quotes budgets, it does not
// move real money, so there is no balance, savings or transaction history here.
export default function WalletPage() {
  return (
    <div>
      <PageTitle
        title="Billetera"
        subtitle="El presupuesto que estás ejecutando. Puedes editar sus ítems aquí sin cambiar el presupuesto original."
      />
      <PlannedBudget />
    </div>
  );
}
