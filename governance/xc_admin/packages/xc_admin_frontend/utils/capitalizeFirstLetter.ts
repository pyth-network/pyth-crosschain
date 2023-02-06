export const capitalizeFirstLetter = (str: string) => {
  return str.replace(/^\w/, (c: string) => c.toUpperCase())
}
