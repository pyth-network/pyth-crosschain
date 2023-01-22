const EditButton = ({
  editable,
  onClick,
}: {
  editable?: boolean
  onClick: React.MouseEventHandler<HTMLButtonElement>
}) => {
  return (
    <button
      className={`bg-darkGray2 py-3 px-6 text-sm font-semibold uppercase outline-none transition-colors`}
      onClick={onClick}
    >
      <span>{editable ? 'done' : 'edit'}</span>
    </button>
  )
}

export default EditButton
