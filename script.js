/* =========================================================
   زردآلو 4.4.4
   script.js
   ========================================================= */

"use strict";

/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://YOUR_PROJECT.supabase.co";

const SUPABASE_KEY =
    "YOUR_SUPABASE_ANON_KEY";

const PRODUCTS_URL =
    `${SUPABASE_URL}/rest/v1/products`;

const REPORTS_URL =
    `${SUPABASE_URL}/rest/v1/reports`;

const MESSAGES_URL =
    `${SUPABASE_URL}/rest/v1/messages`;


/* =========================================================
   LOCAL STORAGE
========================================================= */

const PROFILE_KEY = "zardaloo_profile";
const CART_KEY = "zardaloo_cart";

let profile = null;
let cart = [];
let products = [];

let productImageData = "";
let profileImageData = "";

let selectedAvatar = "👤";

let discountValue = 0;

let currentChatNumber = "";


/* =========================================================
   ابزارهای عمومی
========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* جلوگیری از HTML Injection */
function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* تبدیل اعداد فارسی به انگلیسی */
function normalizeNumber(value) {

    return String(value ?? "")
        .replace(/[۰-۹]/g, d =>
            "۰۱۲۳۴۵۶۷۸۹".indexOf(d)
        )
        .replace(/[٬,]/g, "")
        .trim();
}


/* فقط اعداد */
function onlyDigits(value) {

    return normalizeNumber(value)
        .replace(/\D/g, "");
}


/* قیمت */
function formatPrice(value) {

    const n = Number(
        normalizeNumber(value)
    );

    if (!Number.isFinite(n)) {
        return "0";
    }

    return Math.round(n)
        .toLocaleString("fa-IR");
}


/* پیام وضعیت */
function setStatus(id, text, ok = false) {

    const el = $(id);

    if (!el) {
        return;
    }

    el.textContent = text;

    el.style.color =
        ok ? "#16852b" : "#c62828";

    el.style.marginTop = "10px";
}


/* =========================================================
   اعتبارسنجی امنیتی شماره‌ها
========================================================= */


/*
   شماره تماس زردآلو:

   دقیقاً 11 رقم
   حتماً با 09 شروع شود

   مثال معتبر:
   09123456789
*/
function isValidPhone(value) {

    const phone = onlyDigits(value);

    return /^09\d{9}$/.test(phone);
}


/*
   شماره زردآلو:

   دقیقاً 4 رقم
*/
function isValidZardalooNumber(value) {

    const number =
        onlyDigits(value);

    return /^\d{4}$/.test(number);
}


/*
   نام:
   فقط خالی نباشد و بیش از حد طولانی نباشد.
*/
function isValidName(value) {

    const name =
        String(value ?? "").trim();

    return (
        name.length >= 1 &&
        name.length <= 50
    );
}


/* =========================================================
   ذخیره‌سازی
========================================================= */

function saveProfile() {

    localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify(profile)
    );
}


function saveCart() {

    localStorage.setItem(
        CART_KEY,
        JSON.stringify(cart)
    );
}


function loadLocalData() {

    try {

        profile =
            JSON.parse(
                localStorage.getItem(
                    PROFILE_KEY
                ) || "null"
            );

    } catch {

        profile = null;

    }


    try {

        cart =
            JSON.parse(
                localStorage.getItem(
                    CART_KEY
                ) || "[]"
            );

        if (!Array.isArray(cart)) {

            cart = [];

        }

    } catch {

        cart = [];

    }
}


/* =========================================================
   تصویر پروفایل
========================================================= */

function renderProfileImage(targetId) {

    const el = $(targetId);

    if (!el) {
        return;
    }


    if (
        profile &&
        profile.image
    ) {

        el.innerHTML =
            `<img src="${escapeHTML(
                profile.image
            )}" alt="تصویر پروفایل">`;

    } else {

        el.textContent =
            profile?.avatar || "👤";

    }
}


function selectProfile(avatar) {

    selectedAvatar = avatar;

    profileImageData = "";

    const preview =
        $("profilePreview");

    if (preview) {

        preview.textContent =
            avatar;

    }
}


function loadProfileImage(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }


    /* محدودیت حجم */
    if (
        file.size >
        5 * 1024 * 1024
    ) {

        alert(
            "حجم عکس نباید بیشتر از ۵ مگابایت باشد."
        );

        event.target.value = "";

        return;
    }


    /* فقط فایل تصویری */
    if (
        !file.type ||
        !file.type.startsWith("image/")
    ) {

        alert(
            "لطفاً یک فایل تصویری معتبر انتخاب کنید."
        );

        event.target.value = "";

        return;
    }


    const reader =
        new FileReader();


    reader.onload = () => {

        profileImageData =
            reader.result;

        const preview =
            $("profilePreview");


        if (preview) {

            preview.innerHTML =
                `<img src="${escapeHTML(
                    profileImageData
                )}" alt="تصویر پروفایل">`;

        }

    };


    reader.readAsDataURL(file);
}


/* =========================================================
   ورود
========================================================= */

function openProfileFromWelcome() {

    $("welcomeScreen")
        ?.classList.add("hidden");

    $("profileSetup")
        ?.classList.remove("hidden");
}


async function openMarketFromWelcome() {

    $("welcomeScreen")
        ?.classList.add("hidden");


    if (profile) {

        openApp();

        showPage("market");

        await loadProducts();

        return;
    }


    $("profileSetup")
        ?.classList.remove("hidden");
}


/* =========================================================
   ورود اصلی با اعتبارسنجی
========================================================= */

function enterZardaloo() {

    const name =
        $("firstName")
            ?.value
            .trim();


    let phone =
        $("firstPhone")
            ?.value
            .trim();


    let zardalooNumber =
        $("firstZardaloo")
            ?.value
            .trim();


    /* تبدیل اعداد */
    phone =
        onlyDigits(phone);

    zardalooNumber =
        onlyDigits(zardalooNumber);


    /*
       اعتبارسنجی نام
    */

    if (!isValidName(name)) {

        setStatus(
            "profileMessage",
            "لطفاً نام معتبر خود را وارد کنید."
        );

        return;
    }


    /*
       اعتبارسنجی شماره تماس
    */

    if (!isValidPhone(phone)) {

        setStatus(
            "profileMessage",
            "شماره تماس باید دقیقاً ۱۱ رقم باشد و با 09 شروع شود."
        );

        return;
    }


    /*
       اعتبارسنجی شماره زردآلو
    */

    if (
        !isValidZardalooNumber(
            zardalooNumber
        )
    ) {

        setStatus(
            "profileMessage",
            "شماره زردآلو باید دقیقاً ۴ رقم باشد."
        );

        return;
    }


    /*
       ذخیره پروفایل
    */

    profile = {

        name: name,

        phone: phone,

        zardaloo_number:
            zardalooNumber,

        avatar:
            selectedAvatar || "👤",

        image:
            profileImageData || ""

    };


    saveProfile();


    openApp();

    showPage("home");
}


/* =========================================================
   APP
========================================================= */

function openApp() {

    $("welcomeScreen")
        ?.classList.add("hidden");

    $("profileSetup")
        ?.classList.add("hidden");

    $("app")
        ?.classList.remove("hidden");


    updateProfileUI();

    renderCart();
}


function updateProfileUI() {

    if (!profile) {
        return;
    }


    $("homeName").textContent =
        profile.name || "---";


    $("homePhone").textContent =
        profile.phone || "---";


    $("homeZardaloo").textContent =
        profile.zardaloo_number || "---";


    renderProfileImage(
        "homeProfileImage"
    );


    renderProfileImage(
        "headerProfileImage"
    );


    if (
        $("sellerName") &&
        !$("sellerName").value
    ) {

        $("sellerName").value =
            profile.name || "";

    }


    if (
        $("sellerPhone") &&
        !$("sellerPhone").value
    ) {

        $("sellerPhone").value =
            profile.phone || "";

    }
}


/* =========================================================
   صفحات
========================================================= */

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove(
                "active"
            );

        });


    const page =
        $(pageId);


    if (!page) {
        return;
    }


    page.classList.add(
        "active"
    );


    if (pageId === "market") {

        loadProducts();

    }


    if (pageId === "cart") {

        renderCart();

    }


    if (pageId === "messages") {

        loadMessages();

    }
}


/* =========================================================
   SUPABASE FETCH
========================================================= */

async function supabaseFetch(
    url,
    options = {}
) {

    const headers = {

        "apikey":
            SUPABASE_KEY,

        "Authorization":
            `Bearer ${SUPABASE_KEY}`,

        "Content-Type":
            "application/json",

        ...(options.headers || {})

    };


    const response =
        await fetch(
            url,
            {
                ...options,
                headers
            }
        );


    const text =
        await response.text();


    let data = null;


    try {

        data =
            text
                ? JSON.parse(text)
                : null;

    } catch {

        data = text;

    }


    if (!response.ok) {

        const message =

            typeof data === "object" &&
            data?.message

                ? data.message

                : text ||
                  `HTTP ${response.status}`;


        throw new Error(
            message
        );
    }


    return data;
}


/* =========================================================
   بازار
========================================================= */

async function loadProducts() {

    const status =
        $("marketStatus");


    if (
        !SUPABASE_URL.includes(
            "YOUR_PROJECT"
        )
    ) {

        if (status) {

            status.textContent =
                "در حال دریافت کالاها...";

        }

    }


    try {

        if (
            SUPABASE_URL.includes(
                "YOUR_PROJECT"
            ) ||

            SUPABASE_KEY.includes(
                "YOUR_SUPABASE"
            )

        ) {

            products =
                JSON.parse(
                    localStorage.getItem(
                        "zardaloo_demo_products"
                    ) || "[]"
                );

        } else {

            products =
                await supabaseFetch(
                    `${PRODUCTS_URL}?select=*&order=id.desc`
                );


            if (
                !Array.isArray(products)
            ) {

                products = [];

            }

        }


        renderProducts();


        if (status) {

            status.textContent =
                `${products.length.toLocaleString(
                    "fa-IR"
                )} کالا در بازار`;

            status.style.color =
                "#555";

        }

    } catch (error) {

        products =
            JSON.parse(
                localStorage.getItem(
                    "zardaloo_demo_products"
                ) || "[]"
            );


        renderProducts();


        if (status) {

            status.textContent =
                "دریافت آنلاین کالاها انجام نشد؛ اطلاعات محلی نمایش داده شد.";

            status.style.color =
                "#c62828";

        }


        console.error(error);
    }
}


function getFilteredProducts() {

    const name =
        ($("searchName")
            ?.value || "")
            .trim()
            .toLowerCase();


    const seller =
        ($("sellerFilter")
            ?.value || "")
            .trim()
            .toLowerCase();


    const min =
        Number(
            normalizeNumber(
                $("minPrice")
                    ?.value || ""
            )
        );


    const max =
        Number(
            normalizeNumber(
                $("maxPrice")
                    ?.value || ""
            )
        );


    const gift =
        $("giftFilter")
            ?.value || "";


    return products.filter(
        product => {

            const productName =
                String(
                    product.name || ""
                ).toLowerCase();


            const sellerName =
                String(
                    product.seller || ""
                ).toLowerCase();


            const price =
                Number(
                    product.price || 0
                );


            const hasGift =

                Boolean(product.gift) ||

                Boolean(
                    product.gift_description
                ) ||

                Boolean(
                    product.giftDescription
                );


            if (
                name &&
                !productName.includes(name)
            ) {
                return false;
            }


            if (
                seller &&
                !sellerName.includes(seller)
            ) {
                return false;
            }


            if (
                Number.isFinite(min) &&
                $("minPrice")?.value &&
                price < min
            ) {
                return false;
            }


            if (
                Number.isFinite(max) &&
                $("maxPrice")?.value &&
                price > max
            ) {
                return false;
            }


            if (
                gift === "yes" &&
                !hasGift
            ) {
                return false;
            }


            if (
                gift === "no" &&
                hasGift
            ) {
                return false;
            }


            return true;

        }
    );
}


function renderProducts() {

    const container =
        $("products");


    if (!container) {
        return;
    }


    const list =
        getFilteredProducts();


    if (!list.length) {

        container.innerHTML = `

            <div class="card">

                هنوز کالایی برای نمایش پیدا نشد.

            </div>

        `;

        return;
    }


    container.innerHTML =

        list.map(product => {

            const sellerNumber =

                product.seller_number ||

                product.seller_zardaloo_number ||

                product.owner_zardaloo_number ||

                "---";


            const hasGift =

                Boolean(product.gift) ||

                Boolean(
                    product.gift_description
                ) ||

                Boolean(
                    product.giftDescription
                );


            const image =
                product.image_url ||
                product.image ||
                "";


            return `

                <article class="product-card">

                    ${
                        image

                        ?

                        `<img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(
                                product.name ||
                                "کالا"
                            )}"
                            style="
                                width:100%;
                                height:180px;
                                object-fit:cover;
                                border-radius:14px;
                                margin-bottom:12px;
                            "
                        >`

                        : ""
                    }


                    <h3>
                        ${escapeHTML(
                            product.name ||
                            "بدون نام"
                        )}
                    </h3>


                    <div class="product-price">

                        ${formatPrice(
                            product.price
                        )}

                        ریال

                    </div>


                    <p>

                        <strong>
                            فروشنده:
                        </strong>

                        ${escapeHTML(
                            product.seller ||
                            "---"
                        )}

                    </p>


                    <p>

                        <strong>
                            شماره زردآلو:
                        </strong>

                        ${escapeHTML(
                            sellerNumber
                        )}

                    </p>


                    ${
                        product.description

                        ?

                        `<p style="margin-top:8px;">

                            ${escapeHTML(
                                product.description
                            )}

                        </p>`

                        : ""
                    }


                    ${
                        hasGift

                        ?

                        `<p
                            class="gift"
                            style="margin-top:8px;"
                        >
                            🎁 دارای هدیه
                        </p>`

                        : ""
                    }


                    <button
                        class="yellow-button"
                        type="button"
                        onclick="addToCart('${escapeHTML(
                            String(
                                product.id ?? ""
                            )
                        )}')"
                    >
                        افزودن به سبد خرید
                    </button>

                </article>

            `;

        }).join("");
}


/* فیلترهای بازار */

[
    "searchName",
    "minPrice",
    "maxPrice",
    "sellerFilter",
    "giftFilter"
].forEach(id => {

    const el = $(id);

    if (!el) {
        return;
    }


    el.addEventListener(
        "input",
        renderProducts
    );


    el.addEventListener(
        "change",
        renderProducts
    );

});


/* =========================================================
   ثبت کالا
========================================================= */

function toggleGiftDescription() {

    const box =
        $("giftDescriptionBox");

    const checkbox =
        $("isGift");


    if (
        !box ||
        !checkbox
    ) {
        return;
    }


    box.classList.toggle(
        "hidden",
        !checkbox.checked
    );
}


async function registerProduct() {

    if (!profile) {

        alert(
            "ابتدا وارد زردآلو شوید."
        );

        return;
    }


    const name =
        $("productName")
            ?.value
            .trim();


    const price =
        Number(
            normalizeNumber(
                $("productPrice")
                    ?.value || ""
            )
        );


    const seller =
        $("sellerName")
            ?.value
            .trim();


    let sellerPhone =
        $("sellerPhone")
            ?.value
            .trim();


    const description =
        $("productDescription")
            ?.value
            .trim();


    const isGift =
        Boolean(
            $("isGift")
                ?.checked
        );


    const giftDescription =
        $("giftDescription")
            ?.value
            .trim();


    sellerPhone =
        onlyDigits(
            sellerPhone
        );


    /*
       امنیت:
       شماره فروشنده هم باید معتبر باشد.
    */

    if (
        !name ||
        name.length > 100 ||
        !Number.isFinite(price) ||
        price < 0 ||
        !seller ||
        seller.length > 50 ||
        !isValidPhone(sellerPhone)
    ) {

        setStatus(
            "registerMessage",
            "نام، قیمت، نام فروشنده و شماره تماس معتبر را وارد کنید."
        );

        return;
    }


    const payload = {

        name,

        price:
            Math.round(price),

        seller,

        seller_phone:
            sellerPhone,

        seller_number:
            profile.zardaloo_number,

        seller_zardaloo_number:
            profile.zardaloo_number,

        description,

        gift:
            isGift,

        gift_description:
            isGift
                ? giftDescription
                : ""

    };


    const button =
        $("registerProductButton");


    if (button) {

        button.disabled = true;

    }


    try {

        if (

            SUPABASE_URL.includes(
                "YOUR_PROJECT"
            ) ||

            SUPABASE_KEY.includes(
                "YOUR_SUPABASE"
            )

        ) {

            const localProduct = {

                id:
                    Date.now(),

                ...payload

            };


            const localProducts =

                JSON.parse(
                    localStorage.getItem(
                        "zardaloo_demo_products"
                    ) || "[]"
                );


            localProducts.unshift(
                localProduct
            );


            localStorage.setItem(
                "zardaloo_demo_products",
                JSON.stringify(
                    localProducts
                )
            );


            products =
                localProducts;


            setStatus(
                "registerMessage",
                "کالا با موفقیت ثبت شد.",
                true
            );

        } else {

            await supabaseFetch(
                PRODUCTS_URL,
                {

                    method: "POST",

                    headers: {

                        "Prefer":
                            "return=representation"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );


            setStatus(
                "registerMessage",
                "کالا با موفقیت ثبت شد.",
                true
            );

        }


        $("productName").value = "";

        $("productPrice").value = "";

        $("productDescription").value = "";

        $("isGift").checked = false;

        $("giftDescription").value = "";

        toggleGiftDescription();


        await loadProducts();

    } catch (error) {

        setStatus(
            "registerMessage",
            "ثبت کالا انجام نشد: " +
            error.message
        );

        console.error(error);

    } finally {

        if (button) {

            button.disabled = false;

        }

    }
}


/* =========================================================
   سبد خرید
========================================================= */

function findProductById(id) {

    return products.find(
        product =>
            String(product.id) ===
            String(id)
    );
}


function addToCart(id) {

    const product =
        findProductById(id);


    if (!product) {

        alert(
            "این کالا پیدا نشد."
        );

        return;
    }


    const existing =
        cart.find(
            item =>
                String(item.id) ===
                String(product.id)
        );


    if (existing) {

        existing.quantity =
            Number(
                existing.quantity || 1
            ) + 1;

    } else {

        cart.push({

            id:
                product.id,

            name:
                product.name,

            price:
                Number(
                    product.price || 0
                ),

            quantity:
                1,

            seller:
                product.seller || "",

            image:
                product.image_url ||
                product.image ||
                ""

        });

    }


    saveCart();

    renderCart();


    alert(
        "کالا به سبد خرید اضافه شد."
    );
}


function removeFromCart(id) {

    cart =
        cart.filter(
            item =>
                String(item.id) !==
                String(id)
        );


    saveCart();

    renderCart();
}


function changeCartQuantity(
    id,
    delta
) {

    const item =
        cart.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!item) {
        return;
    }


    item.quantity =
        Number(
            item.quantity || 1
        ) + delta;


    if (
        item.quantity <= 0
    ) {

        removeFromCart(id);

        return;
    }


    saveCart();

    renderCart();
}


function calculateCartTotal() {

    return cart.reduce(

        (
            sum,
            item
        ) =>

            sum +
            Number(
                item.price || 0
            ) *
            Number(
                item.quantity || 1
            ),

        0

    );
}


function applyCartDiscount() {

    const code =
        (
            $("cartDiscountCode")
                ?.value || ""
        )
        .trim();


    if (!code) {

        discountValue = 0;

        setStatus(
            "cartDiscountMessage",
            "کد تخفیف را وارد کنید."
        );

        renderCart();

        return;
    }


    const normalized =
        code.toUpperCase();


    if (
        normalized ===
        "ZARDALOO10"
    ) {

        discountValue = 10;

        setStatus(
            "cartDiscountMessage",
            "۱۰٪ تخفیف اعمال شد.",
            true
        );

    } else if (
        normalized ===
        "ZARDALOO20"
    ) {

        discountValue = 20;

        setStatus(
            "cartDiscountMessage",
            "۲۰٪ تخفیف اعمال شد.",
            true
        );

    } else {

        discountValue = 0;

        setStatus(
            "cartDiscountMessage",
            "کد تخفیف معتبر نیست."
        );

    }


    renderCart();
}


function renderCart() {

    const container =
        $("cartItems");

    const summary =
        $("cartSummary");


    if (
        !container ||
        !summary
    ) {

        return;

    }


    if (!cart.length) {

        container.innerHTML = `

            <div class="card">

                سبد خرید خالی است.

            </div>

        `;


        summary.innerHTML =
            "جمع کل: ۰ ریال";


        return;
    }


    container.innerHTML =

        cart.map(item => `

            <div class="card cart-item">

                <h3>
                    ${escapeHTML(
                        item.name ||
                        "کالا"
                    )}
                </h3>


                <p>

                    قیمت واحد:

                    <strong>

                        ${formatPrice(
                            item.price
                        )}

                        ریال

                    </strong>

                </p>


                <p>

                    تعداد:

                    <strong>

                        ${Number(
                            item.quantity || 1
                        ).toLocaleString(
                            "fa-IR"
                        )}

                    </strong>

                </p>


                <p>

                    قیمت:

                    <strong>

                        ${formatPrice(
                            Number(
                                item.price || 0
                            ) *
                            Number(
                                item.quantity || 1
                            )
                        )}

                        ریال

                    </strong>

                </p>


                <div
                    style="
                        display:flex;
                        gap:8px;
                        flex-wrap:wrap;
                        margin-top:10px;
                    "
                >

                    <button
                        class="yellow-button"
                        style="width:auto;"
                        onclick="changeCartQuantity(
                            '${escapeHTML(
                                String(item.id)
                            )}',
                            1
                        )"
                    >
                        +
                    </button>


                    <button
                        class="yellow-button"
                        style="width:auto;"
                        onclick="changeCartQuantity(
                            '${escapeHTML(
                                String(item.id)
                            )}',
                            -1
                        )"
                    >
                        −
                    </button>


                    <button
                        class="red-button"
                        onclick="removeFromCart(
                            '${escapeHTML(
                                String(item.id)
                            )}'
                        )"
                    >
                        حذف
                    </button>

                </div>

            </div>

        `).join("");


    const total =
        calculateCartTotal();


    const discount =
        Math.round(
            total *
            (discountValue / 100)
        );


    const finalTotal =
        Math.max(
            0,
            total - discount
        );


    summary.innerHTML = `

        <div>

            جمع کالاها:

            <strong>

                ${formatPrice(total)}
                ریال

            </strong>

        </div>


        <div>

            تخفیف:

            <strong>

                ${formatPrice(discount)}
                ریال

            </strong>

        </div>


        <div>

            قیمت نهایی:

            <strong>

                ${formatPrice(finalTotal)}
                ریال

            </strong>

        </div>

    `;
}


/* =========================================================
   پیام‌رسان
========================================================= */

async function sendMessage() {

    if (!profile) {
        return;
    }


    let receiver =
        $("messageReceiver")
            ?.value
            .trim();


    const text =
        $("messageText")
            ?.value
            .trim();


    receiver =
        onlyDigits(receiver);


    if (
        !isValidZardalooNumber(
            receiver
        )
    ) {

        setStatus(
            "messageSendStatus",
            "شماره زردآلو گیرنده باید دقیقاً ۴ رقم باشد."
        );

        return;
    }


    if (!text) {

        setStatus(
            "messageSendStatus",
            "متن پیام را وارد کنید."
        );

        return;
    }


    if (text.length > 2000) {

        setStatus(
            "messageSendStatus",
            "پیام بیش از حد طولانی است."
        );

        return;
    }


    const payload = {

        sender_number:
            profile.zardaloo_number,

        receiver_number:
            receiver,

        message:
            text

    };


    try {

        if (

            SUPABASE_URL.includes(
                "YOUR_PROJECT"
            ) ||

            SUPABASE_KEY.includes(
                "YOUR_SUPABASE"
            )

        ) {

            const local =

                JSON.parse(
                    localStorage.getItem(
                        "zardaloo_messages"
                    ) || "[]"
                );


            local.unshift({

                id:
                    Date.now(),

                ...payload,

                created_at:
                    new Date()
                        .toISOString()

            });


            localStorage.setItem(
                "zardaloo_messages",
                JSON.stringify(local)
            );

        } else {

            await supabaseFetch(
                MESSAGES_URL,
                {

                    method: "POST",

                    headers: {

                        "Prefer":
                            "return=representation"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );

        }


        $("messageText").value = "";


        setStatus(
            "messageSendStatus",
            "پیام ارسال شد.",
            true
        );


        await loadMessages();

    } catch (error) {

        setStatus(
            "messageSendStatus",
            "ارسال پیام انجام نشد: " +
            error.message
        );

    }
}


async function loadMessages() {

    const list =
        $("messageList");


    if (
        !list ||
        !profile
    ) {

        return;
    }


    try {

        let messages = [];


        if (

            SUPABASE_URL.includes(
                "YOUR_PROJECT"
            ) ||

            SUPABASE_KEY.includes(
                "YOUR_SUPABASE"
            )

        ) {

            messages =
                JSON.parse(
                    localStorage.getItem(
                        "zardaloo_messages"
                    ) || "[]"
                );

        } else {

            const sender =
                encodeURIComponent(
                    profile.zardaloo_number
                );


            messages =
                await supabaseFetch(

                    `${MESSAGES_URL}?select=*&or=(sender_number.eq.${sender},receiver_number.eq.${sender})&order=id.desc`

                );


            if (
                !Array.isArray(
                    messages
                )
            ) {

                messages = [];

            }

        }


        if (!messages.length) {

            list.innerHTML = `

                <div class="card">

                    هنوز پیامی وجود ندارد.

                </div>

            `;

            return;
        }


        list.innerHTML =

            messages.map(
                message => `

                    <div class="message-item">

                        <strong>

                            ${escapeHTML(
                                message.sender_number ||
                                "---"
                            )}

                        </strong>

                        →

                        <strong>

                            ${escapeHTML(
                                message.receiver_number ||
                                "---"
                            )}

                        </strong>


                        <p
                            style="margin-top:7px;"
                        >

                            ${escapeHTML(
                                message.message ||
                                ""
                            )}

                        </p>

                    </div>

                `
            ).join("");


    } catch (error) {

        list.innerHTML = `

            <div class="card">

                دریافت پیام‌ها انجام نشد.

            </div>

        `;


        console.error(error);
    }
}


/* =========================================================
   گزارش فروشنده
========================================================= */

async function submitReport() {

    if (!profile) {
        return;
    }


    let sellerNumber =
        $("reportSellerNumber")
            ?.value
            .trim();


    const reason =
        $("reportReason")
            ?.value;


    const description =
        $("reportDescription")
            ?.value
            .trim();


    sellerNumber =
        onlyDigits(
            sellerNumber
        );


    if (
        !isValidZardalooNumber(
            sellerNumber
        )
    ) {

        setStatus(
            "reportMessage",
            "شماره زردآلو فروشنده باید دقیقاً ۴ رقم باشد."
        );

        return;
    }


    if (!description) {

        setStatus(
            "reportMessage",
            "توضیحات گزارش را وارد کنید."
        );

        return;
    }


    if (
        description.length > 2000
    ) {

        setStatus(
            "reportMessage",
            "توضیحات گزارش بیش از حد طولانی است."
        );

        return;
    }


    const payload = {

        reporter_number:
            profile.zardaloo_number,

        seller_number:
            sellerNumber,

        reason,

        description

    };


    try {

        if (

            SUPABASE_URL.includes(
                "YOUR_PROJECT"
            ) ||

            SUPABASE_KEY.includes(
                "YOUR_SUPABASE"
            )

        ) {

            const local =

                JSON.parse(
                    localStorage.getItem(
                        "zardaloo_reports"
                    ) || "[]"
                );


            local.unshift({

                id:
                    Date.now(),

                ...payload,

                created_at:
                    new Date()
                        .toISOString()

            });


            localStorage.setItem(
                "zardaloo_reports",
                JSON.stringify(local)
            );

        } else {

            await supabaseFetch(
                REPORTS_URL,
                {

                    method: "POST",

                    headers: {

                        "Prefer":
                            "return=representation"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );

        }


        $("reportSellerNumber").value = "";

        $("reportDescription").value = "";


        setStatus(
            "reportMessage",
            "گزارش با موفقیت ارسال شد.",
            true
        );


    } catch (error) {

        setStatus(
            "reportMessage",
            "ارسال گزارش انجام نشد: " +
            error.message
        );

    }
}


/* =========================================================
   مدیریت
========================================================= */

function adminLogin() {

    const number =
        $("adminNumber")
            ?.value
            .trim();


    const password =
        $("adminPassword")
            ?.value;


    /*
       توجه:
       این اطلاعات نمونه هستند و امنیت واقعی ایجاد نمی‌کنند.
       برای نسخه نهایی باید احراز هویت مدیریت
       در سمت سرور/Supabase انجام شود.
    */

    const ADMIN_NUMBER =
        "ADMIN";


    const ADMIN_PASSWORD =
        "1234";


    if (
        number === ADMIN_NUMBER &&
        password === ADMIN_PASSWORD
    ) {

        $("adminPanel")
            ?.classList
            .remove("hidden");


        $("adminMessage")
            .textContent =
            "ورود مدیریت موفق بود.";


        $("adminMessage")
            .style.color =
            "#16852b";


        if (
            $("adminProductCount")
        ) {

            $("adminProductCount")
                .textContent =
                products.length
                    .toLocaleString(
                        "fa-IR"
                    );

        }

    } else {

        $("adminPanel")
            ?.classList
            .add("hidden");


        setStatus(
            "adminMessage",
            "شماره مدیریت یا رمز مدیریت اشتباه است."
        );

    }
}


async function loadAdminProducts() {

    const content =
        $("adminContent");


    if (!content) {
        return;
    }


    await loadProducts();


    $("adminProductCount")
        .textContent =
        products.length
            .toLocaleString(
                "fa-IR"
            );


    if (!products.length) {

        content.innerHTML =
            "<p>کالایی وجود ندارد.</p>";

        return;
    }


    content.innerHTML =

        products.map(
            product => `

                <div
                    class="card"
                    style="margin-top:12px;"
                >

                    <strong>

                        ${escapeHTML(
                            product.name ||
                            "---"
                        )}

                    </strong>

                    <br>

                    قیمت:

                    ${formatPrice(
                        product.price
                    )}

                    ریال

                    <br>

                    فروشنده:

                    ${escapeHTML(
                        product.seller ||
                        "---"
                    )}

                    <br>

                    شماره زردآلو:

                    ${escapeHTML(

                        product.seller_number ||

                        product.seller_zardaloo_number ||

                        "---"

                    )}

                </div>

            `
        ).join("");
}


async function loadAdminReports() {

    const content =
        $("adminContent");


    if (!content) {
        return;
    }


    try {

        let reports = [];


        if (

            SUPABASE_URL.includes(
                "YOUR_PROJECT"
            ) ||

            SUPABASE_KEY.includes(
                "YOUR_SUPABASE"
            )

        ) {

            reports =
                JSON.parse(
                    localStorage.getItem(
                        "zardaloo_reports"
                    ) || "[]"
                );

        } else {

            reports =
                await supabaseFetch(
                    `${REPORTS_URL}?select=*&order=id.desc`
                );


            if (
                !Array.isArray(
                    reports
                )
            ) {

                reports = [];

            }

        }


        if (!reports.length) {

            content.innerHTML =
                "<p>گزارشی وجود ندارد.</p>";

            return;
        }


        content.innerHTML =

            reports.map(
                report => `

                    <div
                        class="card"
                        style="margin-top:12px;"
                    >

                        <strong>
                            گزارش فروشنده
                        </strong>


                        <p>

                            گزارش‌دهنده:

                            ${escapeHTML(
                                report.reporter_number ||
                                "---"
                            )}

                        </p>


                        <p>

                            فروشنده:

                            ${escapeHTML(
                                report.seller_number ||
                                "---"
                            )}

                        </p>


                        <p>

                            دلیل:

                            ${escapeHTML(
                                report.reason ||
                                "---"
                            )}

                        </p>


                        <p>

                            توضیحات:

                            ${escapeHTML(
                                report.description ||
                                "---"
                            )}

                        </p>

                    </div>

                `
            ).join("");


    } catch (error) {

        content.innerHTML = `

            <p>
                دریافت گزارش‌ها انجام نشد.
            </p>

        `;


        console.error(error);

    }
}


/* =========================================================
   محدود کردن ورودی‌های شماره
========================================================= */

function setupNumberInputs() {

    const phone =
        $("firstPhone");


    const zardaloo =
        $("firstZardaloo");


    const sellerPhone =
        $("sellerPhone");


    const messageReceiver =
        $("messageReceiver");


    const reportSellerNumber =
        $("reportSellerNumber");


    if (phone) {

        phone.addEventListener(
            "input",
            () => {

                phone.value =
                    onlyDigits(
                        phone.value
                    )
                    .slice(0, 11);

            }
        );

    }


    if (zardaloo) {

        zardaloo.addEventListener(
            "input",
            () => {

                zardaloo.value =
                    onlyDigits(
                        zardaloo.value
                    )
                    .slice(0, 4);

            }
        );

    }


    if (sellerPhone) {

        sellerPhone.addEventListener(
            "input",
            () => {

                sellerPhone.value =
                    onlyDigits(
                        sellerPhone.value
                    )
                    .slice(0, 11);

            }
        );

    }


    if (messageReceiver) {

        messageReceiver.addEventListener(
            "input",
            () => {

                messageReceiver.value =
                    onlyDigits(
                        messageReceiver.value
                    )
                    .slice(0, 4);

            }
        );

    }


    if (reportSellerNumber) {

        reportSellerNumber.addEventListener(
            "input",
            () => {

                reportSellerNumber.value =
                    onlyDigits(
                        reportSellerNumber.value
                    )
                    .slice(0, 4);

            }
        );

    }
}


/* =========================================================
   شروع برنامه
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        loadLocalData();


        setupNumberInputs();


        if (profile) {

            /*
               اگر پروفایل قدیمی خراب باشد،
               دوباره اجازه ورود می‌خواهیم.
            */

            const validSavedProfile =

                isValidName(
                    profile.name
                ) &&

                isValidPhone(
                    profile.phone
                ) &&

                isValidZardalooNumber(
                    profile.zardaloo_number
                );


            if (validSavedProfile) {

                openApp();

                showPage("home");

            } else {

                profile = null;

                localStorage.removeItem(
                    PROFILE_KEY
                );


                $("welcomeScreen")
                    ?.classList
                    .remove("hidden");


                $("profileSetup")
                    ?.classList
                    .add("hidden");


                $("app")
                    ?.classList
                    .add("hidden");

            }

        } else {

            $("welcomeScreen")
                ?.classList
                .remove("hidden");


            $("profileSetup")
                ?.classList
                .add("hidden");


            $("app")
                ?.classList
                .add("hidden");

        }


        $("giftDescriptionBox")
            ?.classList
            .add("hidden");


        if (
            $("sellerName") &&
            profile
        ) {

            $("sellerName").value =
                profile.name || "";

        }


        if (
            $("sellerPhone") &&
            profile
        ) {

            $("sellerPhone").value =
                profile.phone || "";

        }


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Enter"
                ) {

                    return;

                }


                const active =
                    document.activeElement;


                if (
                    active?.id ===
                        "searchName" ||

                    active?.id ===
                        "sellerFilter"
                ) {

                    renderProducts();

                }

            }
        );

    }
);