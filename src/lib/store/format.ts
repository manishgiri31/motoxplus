export const formatPrice = (n: number, c = "INR") =>
  new Intl.NumberFormat(c === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(n / 100);
