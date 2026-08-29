import Link from "next/link";

export default function VerifyNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Plaque non reconnue</h1>
        <p className="mt-2 text-sm text-slate-500">
          Ce numéro de série ou QR code n&apos;est pas enregistré dans la base Stop 3MR.
          Le produit pourrait être contrefait ou non enregistré.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-block">
          Retour
        </Link>
      </div>
    </div>
  );
}
