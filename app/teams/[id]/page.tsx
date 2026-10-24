export default async function EngineRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Engine Room</h1>
      <p className="mt-2 text-sm opacity-70">Team {id}</p>
    </main>
  );
}
