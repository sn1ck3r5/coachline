export function EmptyChartState({ message }: { message?: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
      {message ?? "Not enough data yet — complete more lessons to see a trend"}
    </div>
  );
}
