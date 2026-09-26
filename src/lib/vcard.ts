/**
 * Utility to generate vCard (.vcf) content
 */
export interface VCardData {
    displayName: string;
    bio?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    wechat_id?: string;
    company?: string;
    job_title?: string;
    links?: Array<{ title: string; url: string }>;
    slug: string;
}

export function generateVCard(data: VCardData): string {
    const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${data.displayName}`,
        `N:;${data.displayName};;;`,
    ];

    if (data.job_title) {
        lines.push(`TITLE:${data.job_title}`);
    }

    if (data.company) {
        lines.push(`ORG:${data.company}`);
    }

    if (data.bio) {
        lines.push(`NOTE:${data.bio.replace(/\n/g, ' ')}`);
    }

    if (data.email) {
        lines.push(`EMAIL;TYPE=INTERNET:${data.email}`);
    }

    if (data.phone) {
        lines.push(`TEL;TYPE=CELL:${data.phone}`);
    }

    if (data.whatsapp) {
        // Add WhatsApp as a custom field
        lines.push(`X-WHATSAPP:${data.whatsapp}`);
    }

    if (data.wechat_id) {
        lines.push(`X-WECHAT:${data.wechat_id}`);
    }

    // Add the GenHub URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://genhub.pro';
    lines.push(`URL:${siteUrl}/${data.slug}`);

    // Add other social links as notes or additional URLs
    if (data.links && data.links.length > 0) {
        data.links.forEach(link => {
            lines.push(`X-SOCIALPROFILE;TYPE=${link.title.toLowerCase()}:${link.url}`);
        });
    }

    lines.push('END:VCARD');

    return lines.join('\r\n');
}

/**
 * Triggers a download of the vCard file in the browser
 */
export function downloadVCard(data: VCardData) {
    const content = generateVCard(data);
    const blob = new Blob([content], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${data.slug}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
