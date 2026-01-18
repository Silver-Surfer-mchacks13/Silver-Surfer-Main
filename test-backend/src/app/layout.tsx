export const metadata = {
  title: "Silver Surfer API",
  description: "Backend API for Silver Surfer Chrome Extension",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
