interface IconProps {
  path: string;
  size?: number;
  color?: string;
  spin?: boolean;
}

export function Icon({ path, size = 16, color = "currentColor", spin = false }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={spin ? { animation: "spin 1s linear infinite" } : undefined}
    >
      {spin && (
        <style>{`@keyframes spin { from { transform-origin: center; transform: rotate(0deg); } to { transform-origin: center; transform: rotate(360deg); } }`}</style>
      )}
      <path d={path} />
    </svg>
  );
}
