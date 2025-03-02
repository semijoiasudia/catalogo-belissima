// Constantes e variáveis globais
const repoUrl = "https://api.github.com/repos/semijoiasudia/CatalogoRenataSemijoias/contents/Catalogos";
const descricoesUrl = "https://raw.githubusercontent.com/semijoiasudia/catalogo-belissima/main/ItensDescricao.txt";
const categoriasAtivasUrl = "https://raw.githubusercontent.com/semijoiasudia/catalogo-belissima/main/CategoriasAtivas.txt";
let descricoes = {};
let categoriasAtivas = [];
let currentFolder = '';
const itemsPerPage = 20;
let currentPage = 1;
let allFiles = [];
let currentBanho = 'todos';
let currentSort = 'newest';
let currentModalIndex = 0;
let currentVisibleFiles = [];

// Formatação de preços e cálculos
function formatarPreco(preco) {
    if (!preco) return "Preço não disponível";
    const valorNumerico = parseFloat(preco.replace(/[^0-9,]/g, '').replace(',', '.'));
    if (isNaN(valorNumerico)) return "Preço não disponível";
    return `R$ ${valorNumerico.toFixed(2).replace('.', ',')}`;
}

function calcularParcela(preco) {
    if (!preco || preco === "Preço não disponível") return "Parcela não disponível";
    const valorNumerico = parseFloat(preco.replace('R$ ', '').replace(',', '.'));
    if (isNaN(valorNumerico)) return "Parcela não disponível";
    const valorParcela = valorNumerico / 3;
    return `em até 3x R$ ${valorParcela.toFixed(2).replace('.', ',')} no link de pagamento`;
}

function getNumericPrice(preco) {
    if (!preco || preco === "Preço não disponível") return 0;
    return parseFloat(preco.replace('R$ ', '').replace(',', '.'));
}

// Carregamento de categorias ativas
async function loadCategoriasAtivas() {
    try {
        const response = await fetch(categoriasAtivasUrl);
        if (!response.ok) {
            console.warn("Arquivo CategoriasAtivas.txt não encontrado, todas as categorias serão exibidas.");
            categoriasAtivas = []; // Quando vazio, todas as categorias são exibidas
            return;
        }
        const text = await response.text();
        categoriasAtivas = text.split('\n')
            .map(linha => linha.trim())
            .filter(linha => linha !== '');
        console.log('Categorias ativas carregadas:', categoriasAtivas);
    } catch (error) {
        console.error("Erro ao carregar categorias ativas:", error);
        categoriasAtivas = []; // Em caso de erro, exibir todas as categorias
    }
}

// Carregamento das descrições dos produtos
async function loadDescriptions() {
    try {
        const response = await fetch(descricoesUrl);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const text = await response.text();
        const lines = text.split('\n');
        lines.forEach(line => {
            const [codigo, descricao, preco, banho] = line.split(';');
            if (codigo && descricao && preco && banho) {
                let normalizedBanho = banho.trim().toLowerCase();
                if (normalizedBanho.includes('2 banhos')) {
                    normalizedBanho = '2 banhos';
                }
                descricoes[codigo.trim()] = {
                    descricao: descricao.trim(),
                    preco: formatarPreco(preco.trim()),
                    banho: normalizedBanho
                };
            }
        });
        console.log('Descrições carregadas com sucesso:', Object.keys(descricoes).length);
    } catch (error) {
        console.error("Erro ao carregar descrições:", error);
        document.getElementById('gallery').innerHTML = '<p>Erro ao carregar descrições. Verifique o console.</p>';
    }
}

// Carregamento das categorias de produtos
async function loadCategories() {
    console.log('Iniciando loadCategories');
    try {
        const response = await fetch(repoUrl);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const data = await response.json();
        console.log('Dados das categorias recebidos:', data);
        const tabs = document.getElementById('tabs');
        tabs.innerHTML = '';

        if (!data || !Array.isArray(data)) {
            throw new Error('Resposta da API inválida');
        }

        data.forEach(item => {
            if (item.type === 'dir') {
                // Verificar se a categoria está ativa ou se todas são permitidas (lista vazia)
                if (categoriasAtivas.length === 0 || categoriasAtivas.includes(item.name)) {
                    const tab = document.createElement('button');
                    tab.className = 'tab';
                    tab.textContent = item.name;
                    tab.onclick = () => {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        loadImages(item.name);
                        scrollToActiveTab();
                    };
                    tabs.appendChild(tab);
                }
            }
        });

        // Verificar se há categorias ativas disponíveis
        if (tabs.children.length === 0) {
            tabs.innerHTML = '<p>Nenhuma categoria disponível no momento.</p>';
            return;
        }

        const initialCategory = getQueryParam('categoria');
        let initialTab = null;
        
        // Verificar se a categoria da URL está disponível
        if (initialCategory) {
            initialTab = findTabByText(initialCategory);
        }
        
        // Se não houver categoria na URL ou ela não estiver disponível, tentar "Brincos"
        if (!initialTab) {
            initialTab = findTabByText('Brincos');
        }
        
        // Se "Brincos" não estiver disponível, usar a primeira categoria disponível
        if (!initialTab && tabs.children.length > 0) {
            initialTab = tabs.children[0];
        }
        
        if (initialTab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            initialTab.classList.add('active');
            console.log('Carregando categoria:', initialTab.textContent.trim());
            loadImages(initialTab.textContent.trim());
            scrollToActiveTab();
        } else {
            console.error('Nenhuma categoria disponível para carregar.');
        }
    } catch (error) {
        console.error("Erro ao carregar categorias:", error);
        document.getElementById('tabs').innerHTML = '<p>Erro ao carregar categorias. Verifique o console.</p>';
    }
}

// Função auxiliar para encontrar uma aba por texto
function findTabByText(categoryName) {
    const tabs = document.querySelectorAll('.tab');
    for (let tab of tabs) {
        if (tab.textContent.trim().toLowerCase() === categoryName.toLowerCase()) {
            return tab;
        }
    }
    return null;
}

// Carregamento das imagens de uma categoria
async function loadImages(folderName) {
    console.log('Iniciando loadImages para:', folderName);
    currentFolder = folderName;
    const banhosNaCategoria = new Set();
    currentPage = 1;
    currentBanho = 'todos';

    try {
        const response = await fetch(`${repoUrl}/${encodeURIComponent(folderName)}`);
        if (!response.ok) throw new Error(`Erro HTTP ao carregar imagens: ${response.status}`);
        allFiles = await response.json();
        console.log('Arquivos recebidos:', allFiles);

        if (!allFiles || !Array.isArray(allFiles)) {
            throw new Error('Resposta da API inválida');
        }

        allFiles.forEach(file => {
            if (file.name.endsWith('.jpg') || file.name.endsWith('.png')) {
                const codigo = file.name.split('.')[0];
                const { banho } = descricoes[codigo] || { banho: '' };
                if (banho) {
                    banhosNaCategoria.add(banho);
                }
            }
        });

        displayPage(currentPage, banhosNaCategoria);
        criarBotoesSubcategorias(banhosNaCategoria);
        console.log('Imagens carregadas com sucesso para:', folderName);
    } catch (error) {
        console.error("Erro ao carregar imagens:", error);
        document.getElementById('gallery').innerHTML = '<p>Erro ao carregar imagens. Verifique o console.</p>';
    }
}

// Filtrar arquivos com base nos critérios atuais
function getFilteredFiles() {
    let filtered = allFiles.filter(file => {
        if (!file.name.endsWith('.jpg') && !file.name.endsWith('.png')) return false;
        const codigo = file.name.split('.')[0];
        const banho = (descricoes[codigo] && descricoes[codigo].banho) || '';
        return currentBanho === 'todos' || banho === currentBanho;
    });

    filtered.sort((a, b) => {
        const codigoA = a.name.split('.')[0];
        const codigoB = b.name.split('.')[0];
        const precoA = getNumericPrice(descricoes[codigoA]?.preco || "0");
        const precoB = getNumericPrice(descricoes[codigoB]?.preco || "0");

        switch (currentSort) {
            case 'newest':
                return codigoB.localeCompare(codigoA, undefined, { numeric: true });
            case 'oldest':
                return codigoA.localeCompare(codigoB, undefined, { numeric: true });
            case 'highestPrice':
                return precoB - precoA || codigoB.localeCompare(codigoA, undefined, { numeric: true });
            case 'lowestPrice':
                return precoA - precoB || codigoB.localeCompare(codigoA, undefined, { numeric: true });
            default:
                return 0;
        }
    });

    currentVisibleFiles = filtered; // Armazenar todas as imagens filtradas
    return filtered;
}

// Exibir uma página de produtos
function displayPage(page, banhosNaCategoria) {
    console.log('Exibindo página:', page);
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';
    const filteredFiles = getFilteredFiles();
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedFiles = filteredFiles.slice(start, end);
    console.log('Itens a exibir:', paginatedFiles.length);

    if (paginatedFiles.length === 0) {
        gallery.innerHTML = '<p>Nenhuma imagem encontrada para esta categoria.</p>';
        return;
    }

    paginatedFiles.forEach(file => {
        const codigo = file.name.split('.')[0];
        const { descricao, preco, banho } = descricoes[codigo] || { 
            descricao: "Descrição não disponível. Este ítem pode não estar disponível.", 
            preco: "Preço não disponível",
            banho: ""
        };
        
        // Calcular o valor da parcela
        const valorParcela = calcularParcela(preco);

        const indexInAll = currentVisibleFiles.findIndex(f => f.name === file.name);

        const item = document.createElement('div');
        item.className = 'item';
        item.dataset.banho = banho || 'todos';

        // Criar um container para a imagem e a logo
        const imgContainer = document.createElement('div');
        imgContainer.className = 'img-container';

        const img = document.createElement('img');
        img.src = file.download_url;
        img.alt = descricao || 'Imagem do produto';
        img.onerror = () => console.error(`Erro ao carregar imagem: ${file.download_url}`);
        img.onload = () => console.log(`Imagem carregada: ${file.download_url}`);
        img.onclick = () => showModal(file.download_url, codigo, indexInAll);
        
        // Adicionar a logo marca d'água
        const logo = document.createElement('img');
        logo.src = 'imagens/logo.png';
        logo.className = 'logo-watermark';
        logo.alt = 'Logo';
        
        // Adicionar a imagem e a logo ao container
        imgContainer.appendChild(img);
        imgContainer.appendChild(logo);
        
        const codigoElement = document.createElement('div');
        codigoElement.className = 'codigo';
        codigoElement.textContent = `COD: ${codigo}`;

        const desc = document.createElement('div');
        desc.className = 'description';
        desc.textContent = descricao;

        const precoElement = document.createElement('div');
        precoElement.className = 'preco';
        precoElement.textContent = preco;
        
        const parcelaElement = document.createElement('div');
        parcelaElement.className = 'parcela';
        parcelaElement.textContent = valorParcela;

        item.append(imgContainer, codigoElement, desc, precoElement, parcelaElement);
        gallery.appendChild(item);
    });

    updatePagination();
}

// Atualizar a paginação
function updatePagination() {
    const filteredFiles = getFilteredFiles();
    const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.innerHTML = '';

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Anterior';
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayPage(currentPage, new Set());
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    prevButton.disabled = currentPage === 1;
    paginationDiv.appendChild(prevButton);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Próxima';
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayPage(currentPage, new Set());
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    nextButton.disabled = currentPage === totalPages;
    paginationDiv.appendChild(nextButton);
}

// Aplicar filtro de ordenação
function applySort() {
    currentSort = document.getElementById('sortFilter').value;
    currentPage = 1;
    displayPage(currentPage, new Set());
    console.log('Ordenação aplicada:', currentSort);
}

// Criar botões de subcategorias (banhos)
function criarBotoesSubcategorias(banhosNaCategoria) {
    const subcategoriesDiv = document.getElementById('subcategories');
    subcategoriesDiv.innerHTML = '';

    let botaoTodosExistente = subcategoriesDiv.querySelector('button[data-banho="todos"]');
    if (!botaoTodosExistente) {
        const botaoTodos = document.createElement('button');
        botaoTodos.textContent = 'Todos';
        botaoTodos.dataset.banho = 'todos';
        botaoTodos.classList.add('active');
        botaoTodos.onclick = () => filterByBanho('todos');
        subcategoriesDiv.appendChild(botaoTodos);
    }

    banhosNaCategoria.forEach(banho => {
        if (banho && banho !== '') {
            const botaoBanho = document.createElement('button');
            let displayText = banho.charAt(0).toUpperCase() + banho.slice(1);
            if (banho === '2 banhos') {
                displayText = '2 Banhos';
            }
            botaoBanho.textContent = displayText;
            botaoBanho.dataset.banho = banho;
            botaoBanho.onclick = () => filterByBanho(banho);
            subcategoriesDiv.appendChild(botaoBanho);
        }
    });

    subcategoriesDiv.style.display = 'flex';
}

// Filtrar por tipo de banho
function filterByBanho(banho) {
    currentBanho = banho;
    currentPage = 1;
    
    // Atualize a classe 'active' para o botão selecionado
    const subcategoriesDiv = document.getElementById('subcategories');
    const buttons = subcategoriesDiv.querySelectorAll('button');
    buttons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.banho === banho) {
            button.classList.add('active');
        }
    });
    
    displayPage(currentPage, new Set());
}

// Mostrar modal com a imagem ampliada
function showModal(src, codigo, index) {
    currentModalIndex = index;
    updateModalContent(codigo);
    document.getElementById('imageModal').style.display = 'flex';
    document.body.classList.add('modal-open');
    
    // Adicionar eventos de toque para swipe
    setupSwipeNavigation();
}

// Fechar o modal
function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
    document.body.classList.remove('modal-open');
}

// Atualizar o conteúdo do modal
function updateModalContent(codigo) {
    const file = currentVisibleFiles[currentModalIndex];
    if (!file) return;
    
    const src = file.download_url;
    codigo = file.name.split('.')[0]; // Garantir que estamos usando o código correto
    
    const { descricao, preco } = descricoes[codigo] || { 
        descricao: "Descrição não disponível. Este ítem pode não estar disponível.", 
        preco: "Preço não disponível"
    };
    
    // Calcular o valor da parcela para o modal
    const valorParcela = calcularParcela(preco);
    
    // Limpar o conteúdo da área de captura e adicionar os elementos
    const captureArea = document.getElementById('captureArea');
    
    // Verificar se já existe uma logo e removê-la para evitar duplicações
    const existingLogo = captureArea.querySelector('.logo-watermark');
    if (existingLogo) {
        existingLogo.remove();
    }
    
    document.getElementById('modalImg').src = src;
    document.getElementById('modalCodigo').textContent = `COD: ${codigo}`;
    
    // Adicionar a logo marca d'água no modal
    const logo = document.createElement('img');
    logo.src = 'imagens/logo.png';
    logo.className = 'logo-watermark';
    logo.alt = 'Logo';
    captureArea.appendChild(logo);
    
    document.getElementById('modalInfo').innerHTML = `
        <div class="descricao">${descricao}</div>
        <div class="preco">${preco}</div>
        <div class="parcela">${valorParcela}</div>
    `;
}

// Funções de navegação
function navigatePrev() {
    if (currentModalIndex > 0) {
        currentModalIndex--;
        const prevFile = currentVisibleFiles[currentModalIndex];
        const codigo = prevFile.name.split('.')[0];
        updateModalContent(codigo);
    }
}

function navigateNext() {
    if (currentModalIndex < currentVisibleFiles.length - 1) {
        currentModalIndex++;
        const nextFile = currentVisibleFiles[currentModalIndex];
        const codigo = nextFile.name.split('.')[0];
        updateModalContent(codigo);
    }
}

// Configurar navegação por swipe
function setupSwipeNavigation() {
    const captureArea = document.getElementById('captureArea');
    let touchStartX = 0;
    let touchEndX = 0;
    
    // Remover event listeners anteriores para evitar duplicação
    captureArea.removeEventListener('touchstart', touchStartHandler);
    captureArea.removeEventListener('touchend', touchEndHandler);
    
    // Adicionar novos event listeners
    captureArea.addEventListener('touchstart', touchStartHandler, false);
    captureArea.addEventListener('touchend', touchEndHandler, false);
}

function touchStartHandler(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function touchEndHandler(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 50; // Mínima distância para considerar um swipe
    
    if (touchEndX < touchStartX - swipeThreshold) {
        // Swipe para a esquerda (próxima imagem)
        navigateNext();
    }
    
    if (touchEndX > touchStartX + swipeThreshold) {
        // Swipe para a direita (imagem anterior)
        navigatePrev();
    }
}

// Salvar imagem
function saveImage() {
    html2canvas(document.querySelector("#captureArea"), {
        useCORS: true,
        allowTaint: true,
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `peca-${document.getElementById('modalCodigo').textContent.replace('COD: ', '')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(error => {
        console.error("Erro ao salvar imagem:", error);
    });
}

// Carregar o rodapé
async function loadRodape() {
    try {
        const response = await fetch("https://raw.githubusercontent.com/semijoiasudia/catalogo-belissima/main/rodape.txt");
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const text = await response.text();
        const formattedText = text.replace(/\n/g, '<br>');
        document.getElementById("rodape").innerHTML = `<p class="rodape-text">${formattedText}</p>`;
    } catch (error) {
        console.error("Erro ao carregar rodapé:", error);
        document.getElementById("rodape").innerHTML = '<p>Erro ao carregar rodapé.</p>';
    }
}

// Obter parâmetro da URL
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Rolar para a aba ativa
function scrollToActiveTab() {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        const tabRect = activeTab.getBoundingClientRect();
        const containerRect = activeTab.parentElement.parentElement.getBoundingClientRect();
        const scrollLeft = activeTab.parentElement.parentElement.scrollLeft;
        const tabCenter = tabRect.left + tabRect.width / 2 - containerRect.left + scrollLeft;

        activeTab.parentElement.parentElement.scrollLeft = tabCenter - containerRect.width / 2;
    }
}

// Inicialização da página
window.onload = async () => {
    console.log('Iniciando carregamento da página');
    try {
        // Primeiro carregamos as categorias ativas para saber quais mostrar
        await loadCategoriasAtivas();
        await loadDescriptions();
        await loadCategories();
        await loadRodape();
        console.log('Carregamento da página concluído');
    } catch (error) {
        console.error('Erro no carregamento inicial:', error);
        document.body.innerHTML += '<p>Erro ao iniciar o catálogo. Verifique o console.</p>';
    }
};
