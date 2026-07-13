import QRCode from "qrcode";
import {useEffect, useState} from "react";

function LoyaltyQrCode({className = "", value}) {
  const [qrState, setQrState] = useState({svg: "", value: ""});

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      return undefined;
    }

    QRCode.toString(value, {
      color: {
        dark: "#111111",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 164,
    })
      .then((nextSvg) => {
        if (!cancelled) {
          setQrState({svg: nextSvg, value});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrState({svg: "", value});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  const svg = qrState.value === value ? qrState.svg : "";

  if (!svg) {
    return <div className={`loyalty-qr-placeholder ${className}`.trim()} />;
  }

  return (
    <div
      aria-label="QR-код карты"
      className={`loyalty-qr ${className}`.trim()}
      dangerouslySetInnerHTML={{__html: svg}}
      role="img"
    />
  );
}

export default LoyaltyQrCode;
