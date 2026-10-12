import { QRCodeSVG } from "qrcode.react";
import { summaryCounts, bengaliCount, type Certificate } from "@/lib/certificate";
export function CertificateDocument({ data, verificationUrl }: { data: Certificate; verificationUrl?: string | undefined }) {
 const counts = summaryCounts(data.members);
 return (
        <article className={data.members.length > 15 ? "cer-container cer-long" : "cer-container"} aria-label="পারিবারিক সনদ">
          <div className="certificate-content">
            <table className="certificate-header"><tbody><tr>
              <td className="qr-cell"><div className="qrframe"><QRCodeSVG value={verificationUrl || data.referenceId} size={100} /><br />{data.referenceId}</div></td>
              <td className="heading-cell">
                <div className="government-heading">গণ-প্রজাতন্ত্রী বাংলাদেশ সরকার</div>
                <div className="head-line-1">{data.union} ইউনিয়ন পরিষদ</div>
                <div className="head-line-2"><b>উপজেলা: {data.upazila}, জেলা: {data.district}।</b></div>
                <div className="certificate-website">www.lgoms.org</div>
              </td>
              <td className="portrait-cell"><img src="/images/certificate-portrait.jpeg" alt="সনদের মূল ছবির প্রতিলিপি" /></td>
            </tr></tbody></table>
            <table className="certificate-meta"><tbody><tr>
              <td className="certificate-number">সনদ নং:<div><strong>{data.number}</strong></div></td>
              <td><h1 className="certificate-title">পারিবারিক সনদ</h1></td>
              <td className="certificate-date">তারিখ: <strong>{data.date}</strong></td>
            </tr></tbody></table>
            <hr className="certificate-divider" />
            <div className="inner-text">
              <span className="subject-indent" />এই মর্মে পারিবারিক সনদ দেওয়া যাইতেছে যে, <span className="text-line-full">{data.subject}({data.nationalId || "-"})</span>, পিতা: <span className="text-line-full">{data.father},মাতাঃ {data.mother}</span>, গ্রাম: <span className="text-line-full">{data.village}</span>,ওয়ার্ডঃ<span className="text-line-full compact-value"> {data.ward}</span>,বাসা নং<span className="text-line-full compact-value"> {data.house}</span>, ইউনিয়ন: <span className="text-line-full">{data.union}</span> , উপজেলা: <span className="text-line-full">{data.upazila}</span>, জেলা: <span className="text-line-full">{data.district}</span>, উল্লিখিত ব্যক্তির পরিবারে নিন্মলিখিত সদস্য রহিয়াছে যাদের সম্পর্ক উল্লেখ করা হলো।
            </div>
            <div className="certificate-comment">মন্তব্যঃ <span className="text-line-full">{data.comment}</span></div>
            <table className="family-table" aria-label="পারিবারিক সদস্যদের তালিকা">
              <colgroup><col className="serial-column" /><col className="name-column" /><col className="birth-column" /><col className="age-column" /><col className="relation-column" /></colgroup>
              <thead><tr><th>ক্রম</th><th>সদস্যগনের নাম</th><th>জন্ম তারিখ</th><th>বয়স</th><th>সম্পর্ক</th></tr></thead>
              <tbody>
                {data.members.map((member, index) => <tr key={index}><td>{String(index + 1).padStart(2, "0")}</td><td>{member.name}</td><td>{member.birthDate}</td><td>{member.age}</td><td>{member.relation}</td></tr>)}
                {Array.from({ length: Math.max(0, 15 - data.members.length) }, (_, index) => <tr key={`blank-${index}`} aria-hidden="true"><td /><td /><td /><td /><td /></tr>)}
              </tbody>
            </table>
            <p className="certificate-summary">উল্লিখিত ব্যক্তির <strong>{counts.sons} জন পুত্র,{counts.daughters} জন কন্যা,{counts.spouse} জন স্বামী/স্ত্রী, {counts.father} জন পিতা,{counts.mother} জন মাতা,{counts.brothers} জন ভাই,{counts.sisters} জন বোন, {counts.self} নিজসহ মোট-{counts.total}</strong> (<strong>{bengaliCount(counts.total)}</strong>) জন সদস্য আছে, ইহা ব্যতিত তাহার আর কোন পারিবারিক সদস্য নাই, {data.wardMember || "-"} নং ওয়ার্ড ইউপি সদস্য/সদস্যা এর সুপারিশের ভিত্তিতে প্রদান করা হইল।</p>
            <footer className="certificate-signature"><strong>{data.signer}</strong><br />{data.designation}<br />{data.union} ইউনিয়ন পরিষদ<br />{data.upazila}, {data.district}।</footer>
          </div>
        </article>
 );
}
