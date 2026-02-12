(function () {
    'use strict';

    // ============================================================================
    // GUARD
    // ============================================================================
    if (window.cart) return;

    // ============================================================================
    // CONSTANTS
    // ============================================================================
    const STORAGE_KEY = 'htmxrazor_cart';

    const SELECTORS = {
        cartRoot: 'cart-root',
        cartCount: 'cart-count',
        content: 'content'
    };

    // ============================================================================
    // MINIMAL SIGNAL
    // ============================================================================
    function createSignal(initialValue) {
        let value = initialValue;
        const subscribers = new Set();

        function get() {
            return value;
        }

        function set(newValue) {
            value = newValue;
            subscribers.forEach(fn => fn(value));
        }

        function update(updater) {
            set(updater(value));
        }

        function subscribe(fn) {
            subscribers.add(fn);
            return () => subscribers.delete(fn);
        }

        return { get, set, update, subscribe };
    }

    // ============================================================================
    // STORAGE (Persistence only)
    // ============================================================================
    const Storage = {
        read() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        },
        write(items) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            } catch (err) {
                console.error('Storage write failed:', err);
            }
        },
        clear() {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (err) {
                console.error('Storage clear failed:', err);
            }
        }
    };

    // ============================================================================
    // UTILITIES
    // ============================================================================
    const Utils = {
        escapeHtml(text) {
            if (!text) return '';
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return String(text).replace(/[&<>"']/g, m => map[m]);
        },

        parseProduct(product) {
            if (typeof product === 'string') {
                try { return JSON.parse(product); }
                catch { return null; }
            }
            return product;
        },

        calculateTotal(items) {
            return items.reduce(
                (sum, item) =>
                    sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
                0
            );
        },

        totalQuantity(items) {
            return items.reduce(
                (sum, item) => sum + (Number(item.quantity) || 0),
                0
            );
        }
    };

    // ============================================================================
    // RENDERER
    // ============================================================================
    const Renderer = {
        renderCartItem(item) {
            const lineTotal =
                ((Number(item.price) || 0) *
                    (Number(item.quantity) || 0)).toFixed(2);

            return `
                <div class="cart-item" style="display:flex;align-items:center;margin:0.5rem 0;padding:0.5rem;background:#fff;border-radius:8px;">
                    <img src="${Utils.escapeHtml(item.thumbnail ?? '')}" 
                         alt="${Utils.escapeHtml(item.title)}"
                         style="width:64px;height:64px;object-fit:cover;border-radius:6px;margin-right:0.75rem;" />
                    <div style="flex:1;">
                        <div style="font-weight:600;">${Utils.escapeHtml(item.title)}</div>
                        <div style="color:#666;">
                            €${Number(item.price).toFixed(2)} x 
                            <strong>${Number(item.quantity)}</strong> 
                            = €${lineTotal}
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.25rem;">
                        <button onclick="window.cart.increment(${item.id})">+</button>
                        <button onclick="window.cart.decrement(${item.id})">-</button>
                        <button onclick="window.cart.remove(${item.id})">Suppr</button>
                    </div>
                </div>`;
        },

        renderCart(items) {
            if (!items || items.length === 0) {
                return '<p>Votre panier est vide.</p>';
            }

            const itemsHtml = items.map(this.renderCartItem).join('');
            const total = Utils.calculateTotal(items).toFixed(2);

            return `
                <div>
                    ${itemsHtml}
                    <div style="margin-top:0.75rem;font-weight:700;">
                        Total: €${total}
                    </div>
                </div>`;
        },

        updateDOM(id, html) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        },

        updateText(id, text) {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        }
    };

    // ============================================================================
    // REACTIVE STATE
    // ============================================================================
    const cartItems = createSignal(Storage.read());

    // Persist automatically
    cartItems.subscribe(items => {
        Storage.write(items);
    });

    // Render function (centralized)
    function renderFromState() {
        const items = cartItems.get();

        Renderer.updateDOM(
            SELECTORS.cartRoot,
            Renderer.renderCart(items)
        );

        Renderer.updateText(
            SELECTORS.cartCount,
            Utils.totalQuantity(items).toString()
        );
    }

    // React to state changes
    cartItems.subscribe(() => {
        renderFromState();
    });

    // ============================================================================
    // CART LOGIC
    // ============================================================================
    const CartManager = {
        addItem(product) {
            const parsed = Utils.parseProduct(product);
            if (!parsed || parsed.id == null) return;

            cartItems.update(items => {
                const copy = [...items];
                const idx = copy.findIndex(i => Number(i.id) === Number(parsed.id));

                if (idx >= 0) {
                    copy[idx] = {
                        ...copy[idx],
                        quantity: copy[idx].quantity + 1
                    };
                } else {
                    copy.push({
                        id: parsed.id,
                        title: parsed.title,
                        price: parsed.price,
                        thumbnail: parsed.thumbnail,
                        quantity: 1
                    });
                }

                return copy;
            });
        },

        incrementItem(id) {
            cartItems.update(items =>
                items.map(item =>
                    Number(item.id) === Number(id)
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            );
        },

        decrementItem(id) {
            cartItems.update(items =>
                items
                    .map(item =>
                        Number(item.id) === Number(id)
                            ? { ...item, quantity: item.quantity - 1 }
                            : item
                    )
                    .filter(item => item.quantity > 0)
            );
        },

        removeItem(id) {
            cartItems.update(items =>
                items.filter(item => Number(item.id) !== Number(id))
            );
        },

        clearCart() {
            cartItems.set([]);
            Storage.clear();
        },

        addFromElement(element) {
            if (!element?.dataset) return;

            const id = Number(element.dataset.id);
            if (isNaN(id)) return;

            this.addItem({
                id,
                title: element.dataset.title ?? '',
                price: Number(element.dataset.price) || 0,
                thumbnail: element.dataset.thumbnail ?? ''
            });
        },

        checkout() {
            alert('Passage à la caisse simulé.');
        }
    };

    // ============================================================================
    // HTMX DOM RESYNC
    // ============================================================================
    document.body.addEventListener('htmx:afterSwap', (event) => {
        const target = event?.detail?.target;

        if (
            target?.id === SELECTORS.content ||
            document.getElementById(SELECTORS.cartRoot)
        ) {
            renderFromState();
        }
    });

    // ============================================================================
    // INIT
    // ============================================================================
    window.cart = {
        add: CartManager.addItem.bind(CartManager),
        addFromElement: CartManager.addFromElement.bind(CartManager),
        increment: CartManager.incrementItem.bind(CartManager),
        decrement: CartManager.decrementItem.bind(CartManager),
        remove: CartManager.removeItem.bind(CartManager),
        clear: CartManager.clearCart.bind(CartManager),
        checkout: CartManager.checkout.bind(CartManager)
    };

    // Initial render
    renderFromState();

})();
