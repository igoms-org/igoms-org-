import { QRCodeSVG } from "qrcode.react";
import { summaryCounts, bengaliCount, type Certificate } from "@/lib/certificate";
export function CertificateDocument({
  data,
  verificationUrl,
}: {
  data: Certificate;
  verificationUrl?: string | undefined;
}) {
  const counts = summaryCounts(data.members);
  return (
    <article
      className={data.members.length > 15 ? "cer-container cer-long" : "cer-container"}
      aria-label="পারিবারিক সনদ"
    >
      <div className="certificate-content">
        <table className="certificate-header">
          <tbody>
            <tr>
              <td className="qr-cell">
                <div className="qrframe">
                  <QRCodeSVG value={verificationUrl || data.referenceId} size={100} />
                  <br />
                  {data.referenceId}
                </div>
              </td>
              <td className="heading-cell">
                <div className="government-heading">গণ-প্রজাতন্ত্রী বাংলাদেশ সরকার</div>
                <div className="head-line-1">{data.union} ইউনিয়ন পরিষদ</div>
                <div className="head-line-2">
                  <b>
                    উপজেলা: {data.upazila}, জেলা: {data.district}।
                  </b>
                </div>
                <div className="certificate-website">www.lgoms.org</div>
              </td>
              <td className="portrait-spacer" aria-hidden="true" />
              <td className="portrait-cell">
                <img src="/images/certificate-portrait.jpeg" alt="সনদের মূল ছবির প্রতিলিপি" />
              </td>
            </tr>
          </tbody>
        </table>
        <table className="certificate-meta">
          <tbody>
            <tr>
              <td className="certificate-number">
                সনদ নং:
                <div>
                  <strong>{data.number}</strong>
                </div>
              </td>
              <td className="certificate-title-cell">
                <h1 className="certificate-title">পারিবারিক সনদ</h1>
              </td>
              <td className="certificate-date">
                তারিখ: <strong>{data.date}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <hr className="certificate-divider" />
        <div className="inner-text">
          <span className="subject-indent" />
          <span className="certificate-label">এই মর্মে পারিবারিক সনদ দেওয়া যাইতেছে যে, </span>
          <span className="text-line-full">
            {data.subject}({data.nationalId || "-"})
          </span>
          ,<span className="certificate-label"> পিতা: </span>
          <span className="text-line-full">
            {data.father},মাতাঃ {data.mother}{" "}
          </span>
          ,<span className="certificate-label"> গ্রাম: </span>
          <span className="text-line-full">{data.village} </span>,
          <span className="certificate-label">ওয়ার্ডঃ</span>
          <span className="text-line-full compact-value"> {data.ward}</span>,
          <span className="certificate-label">বাসা নং</span>
          <span className="text-line-full compact-value"> {data.house}</span>,
          <span className="certificate-label"> ইউনিয়ন: </span>
          <span className="text-line-full"> {data.union} </span> ,
          <span className="certificate-label"> উপজেলা:</span>
          <span className="text-line-full">{data.upazila}</span>,
          <span className="certificate-label"> জেলা: </span>
          <span className="text-line-full">{data.district}</span>,
          <span className="certificate-label">
            {" "}
            উল্লিখিত ব্যক্তির পরিবারে নিন্মলিখিত সদস্য রহিয়াছে যাদের সম্পর্ক উল্লেখ করা হলো।{" "}
          </span>
        </div>
        <div className="certificate-comment">
          মন্তব্যঃ <span className="text-line-full">{data.comment}</span>
        </div>
        <table className="family-table" aria-label="পারিবারিক সদস্যদের তালিকা">
          <thead>
            <tr>
              <th className="serial-column">ক্রম</th>
              <th className="name-column">সদস্যগনের নাম</th>
              <th className="birth-column">জন্ম তারিখ</th>
              <th className="age-column">বয়স</th>
              <th className="relation-column">সম্পর্ক</th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((member, index) => (
              <tr key={index}>
                <td>{String(index + 1).padStart(2, "0")}</td>
                <td>{member.name}</td>
                <td>{member.birthDate}</td>
                <td>{member.age}</td>
                <td>{member.relation}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 15 - data.members.length) }, (_, index) => (
              <tr key={`blank-${index}`} aria-hidden="true">
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        <p className="certificate-summary">
          উল্লিখিত ব্যক্তির{" "}
          <strong>
            {counts.sons} জন পুত্র,{counts.daughters} জন কন্যা,{counts.spouse} জন স্বামী/স্ত্রী,{" "}
            {counts.father} জন পিতা,{counts.mother} জন মাতা,{counts.brothers} জন ভাই,
            {counts.sisters} জন বোন, {counts.self} নিজসহ মোট-{counts.total}
          </strong>{" "}
          (<strong>{bengaliCount(counts.total)}</strong>) জন সদস্য আছে, ইহা ব্যতিত তাহার আর কোন
          পারিবারিক সদস্য নাই, {data.wardMember || "-"} নং ওয়ার্ড ইউপি সদস্য/সদস্যা এর সুপারিশের
          ভিত্তিতে প্রদান করা হইল।
        </p>
        <footer className="certificate-signature">
          <strong>{data.signer}</strong>
          <br />
          {data.designation}
          <br />
          {data.union} ইউনিয়ন পরিষদ
          <br />
          {data.upazila}, {data.district}।
        </footer>
      </div>
    </article>
  );
}
