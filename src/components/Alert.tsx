type Props = {
  msg: string
  setAlertErro: (value: boolean) => void
}

export default function AlertApp({ msg }: Props) {
  return (
    <div className="alert alert-danger fade show" role="alert">
      {msg}
    </div>
  )
}
