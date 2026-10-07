"use client"

import { Toaster } from "sonner"

export default function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      theme="dark"
      toastOptions={{
        style: {
          background: "#18181b",
          border: "1px solid #3f3f46",
          color: "#fff",
        },
      }}
    />
  )
}
