export const Avatar = ({
  name,
  color = "purple",
  small = false,
}: {
  name: string;
  color?: string;
  small?: boolean;
}) => (
  <span className={`avatar ${color} ${small ? "small" : ""}`}>
    {name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")}
  </span>
);
