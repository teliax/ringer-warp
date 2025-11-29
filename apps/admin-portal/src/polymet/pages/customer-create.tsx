import { useNavigate } from "react-router-dom";
import { CustomerEditForm } from "@/polymet/components/customer-edit-form";

export function CustomerCreate() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <CustomerEditForm
        onSave={() => navigate("/customers")}
        onCancel={() => navigate("/customers")}
      />
    </div>
  );
}
