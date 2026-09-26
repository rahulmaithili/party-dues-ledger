const https = require('https');
const fs = require('fs');
const path = require('path');

const iconUrls = {
  48: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhCKJz4WSfsIB1984h4lekSewSFW0dbNtJRzGAt7ny3rlvl1y2YFrIHoDM0jOcvNbGumV2sYU6InJ6bPc-Ht0MuEPpCyr4GmsqqwbaeP4LWyghJR3J1wzCgqZSoMMuWqMlUIatURKdZb7iYp44Oi5BIpE2sd55vgfYVGrBsYRgjdar9XALoQtEipXG2p67b/s48/app-icon-48.png",
  72: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi1HuYPDrMzY6sIyTdHtMQxmLPOU0LES23pbfmqdoj9J_4gkl5YJgfa8mNTVH0yjcxHt1R9M0rz5XXTMrbuuwM_fvSMHcc0Dkmk3IWz47Ft2QUjHUav4BrYf8zZjMRoAM4DFmh9-7qX98mRizKUb9vrP3huS9V_SEke-qz8kIBdWhlakqomadmKrr6FTbGO/s72/app-icon-72.png",
  96: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg88DjEWudjcTrgKB6AUiw47kUhY9aXfA5upww1SzidIIUXPJN6KLKcTwWT1gsDNk_7atDJEsNJMCxhnzIt9cLh5EN-KmL46wuTJLRps-JniUasmn1o2hejHjlYnAnmPgcSnYcXHCd8kmes9PRtrHACXhgLiPwCFAjPn_jT4woUAjwptvqwSP_znqtuLnuV/s96/app-icon-96.png",
  128: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg4yhlk4Q2qO6osTMd_C9MW2v1hEKsFgyv4pREtAW-7WFjDwlMs88x_tE5EZhcw9Q7vWtPUHTjXD4m7glEke3k-ZdbjMM-tlicop8ibtgzUTQ_gxSqjOJPijhadfTPdo9lH_HnamPxsr-noGfTeyccqHss-zxmqb04PwcWj-Bgffzcg4ivFJ8NIjJTN_7N9/s128/app-icon-128.png",
  144: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi81HA0icrjdmHb-c2OnfY3FJsNJNptvqEYOXIS3xg8BsMvoUbfP3dCtzgO6AJmKlTp1wY-bAZ-1dcXJ_p4ENdRt5_gz8S3vH7CGo2uv_s_G40GFI4xBTs6KzCRf249N-Mf6-UrKNrtj4f64V542v3cK7TjBj32bKGyf7Vg4JRYQcCk4PDmo2HYnj56Ki13/s144/app-icon-144.png",
  192: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiNTqXmTPnbEXlIG5f0d0F2oxxKxxf79dAnshPdcXuWcyjqvM9w_et6ZnUPZLFtPwXpu1Qmlag8cBY2pNwg70gsdS_zNai0UeqT6lIYRfA0IBT2fxSMFo1CkksXJCQbkzR_7cDb4reMFhW69bbeAGq17XQwwPFSNaYOyVIzWYdVT374PGEoydXvAMa3UdGB/s192/app-icon-192.png",
  256: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEim51XeJ1wa5EetvJtdiGPz2FhRr7OBiUf2UCAu-485htz_QcnMAjSu8RmGRbbanheu37Qa5SR3JkxCuvdAos_icDLkxSCubWlW_-2uMlxZx_6TppfxHHBJly8VnriCJGV0Y0nGqDiLUrqvU-EpMA2ZM1V7wF3TNcznumLpR8N0B6kqxqGttg9I6AurfJJe/s256/app-icon-256.png",
  512: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjqPjuHZPx5Br5iJ01DMuSN_fe3bKSlSduGHuV9T-HGD4fdBXkY0av05pQF_p_vd7n1JO4GJkkeFvo6flEwNaDD-Hlv8afFdjH6L_HygnkF34utlaiZKWkz6NKYBfTk2wmY-CL4I0odDAPCvsQ9TJVCNhelPca_GqutGbz2fewFF-g_9irdTvhcZH3-6BSY/s512/app-icon-512.png",
  1024: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh_4aRQlBmoqrJZPmSMz51oFN0eGT4cq8m7p3iyPsJuvf38KBb20BL1K2aKU1oPPkBQoMwqeBc_Xv99o9BKqBpAb-s5fKOWWbfTL-YRueoFW3msHm3aFhVz73Ys-rLYM7MdaeCZD0YScF0TUwLWaCkGhzZ2udZbpcRys183a7mBJ-zlgvmVnICJ1ZFpCFZK/s1024/app-icon-1024.png"
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function run() {
  const iconsDir = path.join(__dirname, '..', 'icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  for (const [size, url] of Object.entries(iconUrls)) {
    const filename = `icon-${size}.png`;
    const target = path.join(iconsDir, filename);
    process.stdout.write(`Downloading ${filename}... `);
    await download(url, target);
    console.log(`OK (${fs.statSync(target).size} bytes)`);
  }

  // Also copy 512 as maskable and apple touch icon
  fs.copyFileSync(path.join(iconsDir, 'icon-512.png'), path.join(iconsDir, 'icon-maskable-512.png'));
  fs.copyFileSync(path.join(iconsDir, 'icon-192.png'), path.join(iconsDir, 'apple-touch-icon.png'));
  
  // Also create favicon.png at root and in icons/
  fs.copyFileSync(path.join(iconsDir, 'icon-48.png'), path.join(__dirname, '..', 'favicon.png'));
  fs.copyFileSync(path.join(iconsDir, 'icon-48.png'), path.join(iconsDir, 'favicon.png'));
  fs.copyFileSync(path.join(iconsDir, 'icon-96.png'), path.join(iconsDir, 'favicon-96.png'));

  console.log('All icons successfully downloaded and set up!');
}

run().catch(console.error);
