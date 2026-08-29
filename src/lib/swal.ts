import Swal from "sweetalert2";

const confirmColor = "#dc2626";
const cancelColor = "#64748b";

export async function swalConfirm(
  title: string,
  text: string,
  confirmText = "Confirmer"
): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    cancelButtonColor: cancelColor,
    confirmButtonText: confirmText,
    cancelButtonText: "Annuler",
    reverseButtons: true,
  });
  return result.isConfirmed;
}

export function swalSuccess(title: string, text?: string) {
  return Swal.fire({
    title,
    text,
    icon: "success",
    confirmButtonColor: confirmColor,
  });
}

export function swalError(title: string, text?: string) {
  return Swal.fire({
    title,
    text,
    icon: "error",
    confirmButtonColor: confirmColor,
  });
}

export function swalToast(icon: "success" | "error" | "info" | "warning", title: string) {
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    showConfirmButton: false,
    timer: 2800,
    timerProgressBar: true,
  });
}
