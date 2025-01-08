const { Plugin, ItemView, Notice, Setting, PluginSettingTab, setIcon, MarkdownRenderer, Modal, TFile, TFolder } = require('obsidian');

// 自定义视图类型常量
const CHAT_VIEW_TYPE = 'chat-ai-view';

// 默认设置
const DEFAULT_SETTINGS = {
    apiKey: [],
    baseUrl: [],
    model: [],
    currentApiKey: '',
    currentBaseUrl: 'https://yunwu.ai',
    currentModel: 'gpt-4',
    chatHistory: [], // 用于存储对话历史
    currentHistoryFile: '', // 当前对话历史文件路径
    tempHistoryFile: '', // 添加临时文件路径
    autoClearOnRestart: false, // 新增选项：是否自动清空记录
    autoFocus: true, // 添加自动聚焦设置,默认开启
    focusMode: false, // 新增专注模式开关
    fontSize: 14, // 添加默认字体大小设置
    historyPath: '', // 添加历史记录路径设置，默认为空
};

// 在 DEFAULT_SETTINGS 后添加预设配置
const PRESET_OPTIONS = {
    apiKeys: [
        { label: '默认API密钥', value: '' },
        { label: 'OpenAI官方', value: 'sk-...' },
        { label: 'YunWu.AI', value: 'yw-...' }
    ],
    baseUrls: [
        { label: 'YunWu.AI', value: 'https://yunwu.ai' },
        { label: 'OpenAI官方', value: 'https://api.openai.com' }
    ],
    models: [
        { label: 'GPT-4', value: 'gpt-4' },
        { label: 'GPT-3.5', value: 'gpt-3.5-turbo' },
        { label: 'Claude-3', value: 'claude-3-opus-20240229' }
    ]
};

// 添加 TextEditModal 类
class TextEditModal extends Modal {
    constructor(app, title, initialValue, onSubmit) {
        super(app);
        this.title = title;
        this.initialValue = initialValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: this.title });

        // 创建文本区域
        this.textArea = contentEl.createEl('textarea', {
            cls: 'text-edit-modal-textarea',
            attr: {
                rows: '10',
                style: 'width: 100%; font-family: monospace; resize: vertical;'
            }
        });
        this.textArea.value = this.initialValue;

        // 创建按钮容器
        const buttonContainer = contentEl.createDiv({
            cls: 'text-edit-modal-buttons',
            attr: {
                style: 'display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;'
            }
        });

        // 取消按钮
        const cancelButton = buttonContainer.createEl('button', { text: '取消' });
        cancelButton.addEventListener('click', () => this.close());

        // 保存按钮
        const submitButton = buttonContainer.createEl('button', {
            cls: 'mod-cta',
            text: '保存'
        });
        submitButton.addEventListener('click', () => {
            this.onSubmit(this.textArea.value);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 在 TextEditModal 类后添加新的设置弹窗类
class SettingsModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 添加标题
        contentEl.createEl('h2', { 
            text: '对话AI 设置',
            attr: {
                style: 'margin-bottom: 0.5em;' // 减小底部边距
            }
        });
        
        // 添加链接
        const link = contentEl.createEl('a', {
            text: '全网超低价中转api，点击这里获取',
            attr: {
                href: 'https://yunwu.ai/register?aff=zah7',
                style: 'color: var(--text-accent); font-size: 0.9em; text-decoration: none; display: block; margin-bottom: 1.5em;'
            }
        });
        
        // 添加悬停效果
        link.addEventListener('mouseover', () => {
            link.style.textDecoration = 'underline';
        });
        
        link.addEventListener('mouseout', () => {
            link.style.textDecoration = 'none';
        });
        
        // 处理点击事件，在默认浏览器中打开链接
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://yunwu.ai/register?aff=zah7', '_blank');
        });

        // API Key 设置
        new Setting(contentEl)
            .setName('API 密钥')
            .setDesc('选择或编辑你的 API 密钥列表')
            .addDropdown(dropdown => {
                // 确保 apiKey 是数组
                if (!Array.isArray(this.plugin.settings.apiKey)) {
                    this.plugin.settings.apiKey = this.plugin.settings.apiKey.split('\n').filter(line => line.trim());
                }
                // 添加选项到下拉菜单
                this.plugin.settings.apiKey.forEach(line => {
                    const match = line.match(/(.*?)(sk-\S+)/);
                    if (match) {
                        const [_, note, key] = match;
                        const displayText = note.trim()
                            ? `${note.trim()} (${key.substring(0, 10)}...)`
                            : `${key.substring(0, 10)}...`;
                        dropdown.addOption(line.trim(), displayText);
                    } else {
                        dropdown.addOption(line.trim(), line.trim());
                    }
                });
                // 设置当前选中值
                if (this.plugin.settings.apiKey.length > 0) {
                    dropdown.setValue(this.plugin.settings.currentApiKey || this.plugin.settings.apiKey[0]);
                }
                // 处理选择变更
                dropdown.onChange(async (value) => {
                    this.plugin.settings.currentApiKey = value;
                    await this.plugin.saveSettings();
                });
            })
            .addButton(button => button
                .setButtonText('编辑列表')
                .onClick(() => {
                    const modal = new TextEditModal(
                        this.app,
                        '编辑 API 密钥列表',
                        Array.isArray(this.plugin.settings.apiKey)
                            ? this.plugin.settings.apiKey.join('\n')
                            : this.plugin.settings.apiKey,
                        async (result) => {
                            const apiKeys = result.split('\n').filter(line => line.trim());
                            this.plugin.settings.apiKey = apiKeys;
                            this.plugin.settings.currentApiKey = apiKeys.length > 0 ? apiKeys[0] : '';
                            await this.plugin.saveSettings();
                            this.onOpen(); // 重新加载设置界面
                        }
                    );
                    modal.open();
                }));

        // Base URL 设置
        new Setting(contentEl)
            .setName('Base URL')
            .setDesc('选择或编辑API基础地址列表')
            .addDropdown(dropdown => {
                if (!Array.isArray(this.plugin.settings.baseUrl)) {
                    this.plugin.settings.baseUrl = [this.plugin.settings.baseUrl];
                }
                this.plugin.settings.baseUrl.forEach(url => {
                    dropdown.addOption(url.trim(), url.trim());
                });
                dropdown.setValue(this.plugin.settings.currentBaseUrl)
                dropdown.onChange(async (value) => {
                    this.plugin.settings.currentBaseUrl = value;
                    await this.plugin.saveSettings();
                });
            })
            .addButton(button => button
                .setButtonText('编辑列表')
                .onClick(() => {
                    const modal = new TextEditModal(
                        this.app,
                        '编辑基础地址列表',
                        Array.isArray(this.plugin.settings.baseUrl)
                            ? this.plugin.settings.baseUrl.join('\n')
                            : this.plugin.settings.baseUrl,
                        async (result) => {
                            const urls = result.split('\n').filter(line => line.trim());
                            this.plugin.settings.baseUrl = urls;
                            this.plugin.settings.currentBaseUrl = urls.length > 0 ? urls[0] : '';
                            await this.plugin.saveSettings();
                            this.onOpen();
                        }
                    );
                    modal.open();
                }));

        // 模型名称设置
        new Setting(contentEl)
            .setName('模型名称')
            .setDesc('选择或编辑模型名称列表')
            .addDropdown(dropdown => {
                if (!Array.isArray(this.plugin.settings.model)) {
                    this.plugin.settings.model = [this.plugin.settings.model];
                }
                this.plugin.settings.model.forEach(model => {
                    dropdown.addOption(model.trim(), model.trim());
                });
                dropdown.setValue(this.plugin.settings.currentModel)
                dropdown.onChange(async (value) => {
                    this.plugin.settings.currentModel = value;
                    await this.plugin.saveSettings();
                });
            })
            .addButton(button => button
                .setButtonText('编辑列表')
                .onClick(() => {
                    const modal = new TextEditModal(
                        this.app,
                        '编辑模型名称列表',
                        Array.isArray(this.plugin.settings.model)
                            ? this.plugin.settings.model.join('\n')
                            : this.plugin.settings.model,
                        async (result) => {
                            const models = result.split('\n').filter(line => line.trim());
                            this.plugin.settings.model = models;
                            this.plugin.settings.currentModel = models.length > 0 ? models[0] : '';
                            await this.plugin.saveSettings();
                            this.onOpen();
                        }
                    );
                    modal.open();
                }));

        // 新增：自动清空记录选项
        new Setting(contentEl)
            .setName('自动清空记录')
            .setDesc('如果开启，每次重启面板都会把之前的对话记录保存为一个历史记录，并清空对话窗口。')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.autoClearOnRestart)
                    .onChange(async (value) => {
                        this.plugin.settings.autoClearOnRestart = value;
                        await this.plugin.saveSettings();
                    });
            });

        // 添加自动聚焦设置
        new Setting(contentEl)
            .setName('自动聚焦')
            .setDesc('打开面板时自动聚焦到输入框')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.autoFocus)
                    .onChange(async (value) => {
                        this.plugin.settings.autoFocus = value;
                        await this.plugin.saveSettings();
                    });
            });

        // 新增专注模式开关
        new Setting(contentEl)
            .setName('专注模式')
            .setDesc('打开后，面板上方按钮和选择参数行只有在鼠标悬浮时才会显示。')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.focusMode)
                    .onChange(async (value) => {
                        this.plugin.settings.focusMode = value;
                        await this.plugin.saveSettings();
                        // 更新所有打开的聊天视图的专注模式
                        this.plugin.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE).forEach(leaf => {
                            if (leaf.view instanceof ChatView) {
                                leaf.view.updateFocusMode();
                            }
                        });
                    });
            });

        // 添加历史记录路径设置
        new Setting(contentEl)
            .setName('历史记录路径')
            .setDesc('设置对话历史记录的存放路径（例如：AI/历史记录）')
            .addText(text => {
                text.setPlaceholder('输入历史记录存放路径')
                    .setValue(this.plugin.settings.historyPath)
                    .onChange(async (value) => {
                        // 移除开头的斜杠
                        value = value.replace(/^\/+/, '');
                        // 移除结尾的斜杠
                        value = value.replace(/\/+$/, '');
                        
                        this.plugin.settings.historyPath = value;
                        // 更新临时文件路径
                        this.plugin.settings.tempHistoryFile = value ? `${value}/临时对话.md` : '';
                        await this.plugin.saveSettings();
                        
                        // 确保文件夹存在
                        if (value) {
                            try {
                                const folder = this.plugin.app.vault.getAbstractFileByPath(value);
                                if (!(folder instanceof TFolder)) {
                                    await this.plugin.app.vault.createFolder(value);
                                }
                            } catch (error) {
                                console.error('创建历史记录文件夹失败:', error);
                                new Notice('创建历史记录文件夹失败，请检查路径是否合法');
                            }
                        }
                    });
            })
            .addExtraButton(button => {
                button
                    .setIcon('folder')
                    .setTooltip('选择文件夹')
                    .onClick(async () => {
                        // 创建文件夹选择模态框
                        new FolderSuggestModal(this.app, async (folder) => {
                            const path = folder.path;
                            this.plugin.settings.historyPath = path;
                            this.plugin.settings.tempHistoryFile = `${path}/临时对话.md`;
                            await this.plugin.saveSettings();
                            this.onOpen(); // 使用 onOpen 替代 display
                        }).open();
                    });
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 添加文件夹选择模态框类
class FolderSuggestModal extends Modal {
    constructor(app, onChoose) {
        super(app);
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '选择历史记录存放文件夹' });
        
        const folderList = contentEl.createDiv({
            cls: 'folder-list',
            attr: {
                style: 'max-height: 400px; overflow-y: auto; margin-top: 10px;'
            }
        });

        // 获取所有文件夹
        const folders = this.getAllFolders();
        
        folders.forEach(folder => {
            const folderItem = folderList.createDiv({
                cls: 'folder-item',
                attr: {
                    style: 'padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 4px;'
                }
            });
            
            // 添加缩进效果
            const indent = '&nbsp;'.repeat(folder.depth * 4);
            folderItem.innerHTML = `${indent}📁 ${folder.name}`;
            
            // 添加悬停效果
            folderItem.addEventListener('mouseover', () => {
                folderItem.style.backgroundColor = 'var(--background-modifier-hover)';
            });
            
            folderItem.addEventListener('mouseout', () => {
                folderItem.style.backgroundColor = '';
            });
            
            // 点击选择文件夹
            folderItem.addEventListener('click', () => {
                this.onChoose(folder.folder); // 确保调用了 onChoose 回调
                this.close();
            });
        });
    }

    getAllFolders(root = this.app.vault.getRoot(), depth = 0) {
        let folders = [];
        
        if (root instanceof TFolder) {
            folders.push({
                folder: root,
                name: root.name,
                depth: depth
            });
            
            root.children.forEach(child => {
                if (child instanceof TFolder) {
                    folders = folders.concat(this.getAllFolders(child, depth + 1));
                }
            });
        }
        
        return folders;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 定义聊天视图类
class ChatView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.messages = [];
        this.handleWheel = this.handleWheel.bind(this); // 绑定滚轮事件处理器
    }

    getViewType() {
        return CHAT_VIEW_TYPE;
    }

    getDisplayText() {
        return "AI Chat"; // 已移除 "对话AI" 字样
    }

    getIcon() {
        return 'message-square'; // 使用 Obsidian 内置的 message-square 图标
    }

    async onOpen() {
        console.log('ChatView onOpen 开始执行');
        console.log('当前自动清空设置:', this.plugin.settings.autoClearOnRestart);
        console.log('当前消息数量:', this.messages.length);
        
        this.containerEl.empty();
        this.containerEl.addClass('workspace-leaf-content');
        this.containerEl.setAttribute('data-type', CHAT_VIEW_TYPE);

        // 创建导航头部
        const navHeader = this.containerEl.createDiv('nav-header');
        const navButtonsContainer = navHeader.createDiv('nav-buttons-container');

        // 创建视图头部
        const viewHeader = this.containerEl.createDiv('view-header');
        const viewHeaderLeft = viewHeader.createDiv('view-header-left');
        const viewHeaderTitle = viewHeader.createDiv('view-header-title-container mod-at-start');
        viewHeaderTitle.createDiv('view-header-title').setText('AI Chat');
        const viewActions = viewHeader.createDiv('view-actions');

        // 统一的按钮样式
        const buttonStyle = 'margin: 0; display: inline-block; width: 80px; text-align: center; white-space: nowrap;';

        // 统一的下拉菜单样式
        const selectStyle = 'flex: 1; padding: 4px; border-radius: 4px; background: var(--background-modifier-form-field); width: 80px;';

        // 创建按钮，添加统一样式
        const newConversationButton = navButtonsContainer.createEl('button', { 
            cls: 'chat-ai-header-button', 
            text: '新建',
            attr: { style: buttonStyle }
        });
        const clearButton = navButtonsContainer.createEl('button', { 
            cls: 'chat-ai-header-button', 
            text: '清空',
            attr: { style: buttonStyle }
        });
        const settingsButton = navButtonsContainer.createEl('button', { 
            cls: 'chat-ai-header-button', 
            text: '设置',
            attr: { style: buttonStyle }
        });

        // 创建下拉菜单容器
        const dropdownsContainer = navButtonsContainer.createDiv({
            cls: 'header-dropdowns',
            attr: {
                style: 'display: flex; gap: 5px; flex: 1; margin-left: 5px;'
            }
        });

        // 修改下拉菜单的样式
        const baseUrlSelect = dropdownsContainer.createEl('select', {
            cls: 'chat-ai-dropdown',
            attr: { style: selectStyle }
        });

        const apiKeySelect = dropdownsContainer.createEl('select', {
            cls: 'chat-ai-dropdown',
            attr: { style: selectStyle }
        });

        const modelSelect = dropdownsContainer.createEl('select', {
            cls: 'chat-ai-dropdown',
            attr: { style: selectStyle }
        });

        // Base URL 下拉菜单
        this.plugin.settings.baseUrl.forEach(url => {
            const urlMatch = url.match(/(.*?)(https?:\/\/\S+)/);
            const displayText = urlMatch && urlMatch[1].trim() 
                ? urlMatch[1].trim()  // 如果有备注就只显示备注
                : url;  // 没有备注才显示完整URL
            const option = baseUrlSelect.createEl('option', {
                text: displayText,
                value: url
            });
            if (url === this.plugin.settings.currentBaseUrl) {
                option.selected = true;
            }
        });
        baseUrlSelect.addEventListener('change', async (e) => {
            this.plugin.settings.currentBaseUrl = e.target.value;
            await this.plugin.saveSettings();
        });

        // API Key 下拉菜单
        this.plugin.settings.apiKey.forEach(key => {
            const match = key.match(/(.*?)(sk-\S+)/);
            const displayText = match && match[1].trim()
                ? match[1].trim()  // 如果有备注就只显示备注
                : key.substring(0, 10) + '...';  // 没有备注才显示截断的key
            const option = apiKeySelect.createEl('option', {
                text: displayText,
                value: key
            });
            if (key === this.plugin.settings.currentApiKey) {
                option.selected = true;
            }
        });
        apiKeySelect.addEventListener('change', async (e) => {
            this.plugin.settings.currentApiKey = e.target.value;
            await this.plugin.saveSettings();
        });

        // Model 下拉菜单
        this.plugin.settings.model.forEach(model => {
            const option = modelSelect.createEl('option', {
                text: model,
                value: model
            });
            if (model === this.plugin.settings.currentModel) {
                option.selected = true;
            }
        });
        modelSelect.addEventListener('change', async (e) => {
            this.plugin.settings.currentModel = e.target.value;
            await this.plugin.saveSettings();
        });

        // 添加事件监听
        newConversationButton.addEventListener('click', async () => {
            await this.handleNewConversation();
        });

        clearButton.addEventListener('click', async () => {
            if (this.messages.length === 0) {
                new Notice('没有对话内容可清空');
                return;
            }
            this.messages = [];
            this.messagesContainer.empty();
            this.plugin.settings.chatHistory = [];
            this.plugin.saveSettings();
            // 清空时也更新临时文件
            await this.saveTempChatHistory();
            // new Notice('对话记录已清空');
        });

        settingsButton.addEventListener('click', () => {
            new SettingsModal(this.app, this.plugin).open();
        });

        // 消息显示域
        this.messagesContainer = this.containerEl.createDiv({ cls: 'chat-ai-messages' });

        // 创建图片预览区域，放置在输入区域上方
        this.imagePreviewArea = this.containerEl.createDiv({
            cls: 'chat-ai-image-preview',
            attr: {
                style: 'display: none; width: 100%; padding: 8px; background: var(--background-primary-alt); border-bottom: 1px solid var(--background-modifier-border);' // 添加适当样式
            }
        });

        // 创建输入域
        const inputArea = this.containerEl.createDiv({ 
            cls: 'chat-ai-input-area',
            attr: {
                style: 'display: flex; flex-direction: column; padding: 12px; gap: 8px;'
            }
        });


        // 创建输入框和按钮的容��
        const inputButtonContainer = inputArea.createDiv({
            attr: {
                style: 'display: flex; gap: 8px;'
            }
        });

        // 创建左侧输入框
        this.textarea = inputButtonContainer.createEl('textarea', { 
            cls: 'chat-ai-textarea', 
            attr: { 
                rows: 3,
                placeholder: '输入你的问题...',
                style: 'flex: 1; min-height: 80px; max-height: 200px; margin: 0; padding: 12px; box-sizing: border-box; line-height: 1.5;'
            }
        });

        // 创建右侧按钮容器
        const buttonContainer = inputButtonContainer.createDiv({
            attr: {
                style: 'display: flex; flex-direction: column; gap: 8px; width: 80px;'
            }
        });

        // 创建发送按钮
        this.sendButton = buttonContainer.createEl('button', { 
            cls: 'chat-ai-send-button', 
            text: '发送',
            attr: {
                style: 'height: 40px; width: 100%;'
            }
        });

        // 创建图片上传按钮
        const uploadButton = buttonContainer.createEl('button', {
            cls: 'chat-ai-upload-button',
            attr: {
                style: 'height: 32px; width: 100%; background: var(--background-modifier-border); border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;'
            }
        });
        setIcon(uploadButton, 'image');

        // 绑定事件
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // 加载并渲染已有的对话历史
        await this.loadChatHistory();

        // 添加悬停提示
        const addHoverTooltip = (selectEl) => {
            let tooltipTimeout;
            let tooltipEl;

            selectEl.addEventListener('mouseover', (e) => {
                if (e.target.scrollWidth > e.target.offsetWidth) {
                    tooltipTimeout = setTimeout(() => {
                        tooltipEl = document.createElement('div');
                        tooltipEl.className = 'select-tooltip';
                        tooltipEl.textContent = e.target.value;
                        document.body.appendChild(tooltipEl);

                        const rect = e.target.getBoundingClientRect();
                        tooltipEl.style.left = `${rect.left}px`;
                        tooltipEl.style.top = `${rect.bottom + 5}px`;
                    }, 1000);
                }
            });

            selectEl.addEventListener('mouseout', () => {
                clearTimeout(tooltipTimeout);
                if (tooltipEl) {
                    tooltipEl.remove();
                    tooltipEl = null;
                }
            });
        };

        // 为每个下拉菜单添加悬停提示
        [baseUrlSelect, apiKeySelect, modelSelect].forEach(select => {
            addHoverTooltip(select);
        });

        // 监听主题变化
        this.registerThemeObserver();

        // 初始化图片上传功能
        this.initializeImageUpload();

        // 添加样式
        this.addStyle();

        // 修改自动聚焦逻辑
        if (this.plugin.settings.autoFocus) {
            console.log('Attempting to focus textarea...');
            setTimeout(() => {
                if (this.textarea) {
                    console.log('Textarea found, focusing...');
                    this.textarea.focus();
                } else {
                    console.log('Textarea not found!');
                }
            }, 100);
        }

        // 根据专注模式设置样式
        if (this.plugin.settings.focusMode) {
            this.containerEl.addClass('focus-mode');
        } else {
            this.containerEl.removeClass('focus-mode');
        }

        // 应用保存的字体大小
        this.applyFontSize();
        
        // 添加滚轮事件监听
        this.containerEl.addEventListener('wheel', this.handleWheel);
    }

    // 新增：处理新建对话
    async handleNewConversation() {
        if (this.messages.length > 0) {
            try {
                await this.plugin.saveChatHistoryToFile(this.messages);
            } catch (error) {
                console.error('保存对话历史时出错:', error);
                new Notice('保存对话历史时出错');
                return;
            }
        }
        // 清空当前对话
        this.messages = [];
        this.messagesContainer.empty();
        this.plugin.settings.chatHistory = [];
        this.plugin.settings.currentHistoryFile = '';
        await this.plugin.saveSettings();

        // 移除对 autoFocus 设置的检查，新建后总是聚焦
        setTimeout(() => {
            if (this.textarea) {
                this.textarea.focus();
            }
        }, 100);
    }

    async handleSendMessage() {
        const content = this.textarea.value.trim();
        if (!content && this.pendingImages.length === 0) return;
        
        // 保存图片URL到消息中
        const messageWithImages = {
            role: 'user',
            content: content,
            time: new Date(),
            images: [...this.pendingImages]
        };

        this.addMessage(messageWithImages.role, messageWithImages.content, messageWithImages.time, true, messageWithImages.images);
        this.textarea.value = '';
        this.scrollToBottom();

        // 清空图片预览区域和待发送图片数组
        this.imagePreviewArea.style.display = 'none';
        this.imagePreviewArea.empty();
        this.pendingImages = [];
        
        // 保存到临时文件
        await this.saveTempChatHistory();

        // 创建一个临时的助手消息容器
        const assistantMessage = this.createAssistantMessageElement();
        this.scrollToBottom();

        try {
            await this.callAI(content, assistantMessage);
            // AI回复完成后保存到临时文件
            await this.saveTempChatHistory();
        } catch (error) {
            console.error('调用AI时发生错误:', error);
            assistantMessage.querySelector('.message-content').textContent = `错误: ${error.message}`;
            new Notice('调用AI时发生错误。');
        }
    }

    addMessage(role, content, time = new Date(), save = true, images = []) {
        const messageData = { role, content, time, images };
        this.messages.push(messageData);
        if (save) {
            this.plugin.settings.chatHistory.push(messageData);
            this.plugin.saveSettings();
        }

        const messageEl = this.messagesContainer.createDiv({ 
            cls: `chat-ai-message`,
            attr: {
                'data-role': role  // 添加角色属性
            }
        });
        
        // 创建消息内容容器
        const contentContainer = messageEl.createDiv({ cls: 'message-content' });

        if (role === 'assistant') {
            // 使用 MarkdownRenderer 渲染所有 AI 消息
            MarkdownRenderer.renderMarkdown(content, contentContainer, this.plugin.app.workspace.getActiveFile()?.path || '', this);
        } else {
            // 用户消息作为纯文本显示
            contentContainer.setText(content);

            // 如果有图片，显示图片预览
            if (images && images.length > 0) {
                const imageContainer = messageEl.createDiv({
                    cls: 'message-images',
                    attr: {
                        style: 'display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;'
                    }
                });

                images.forEach(base64Image => {
                    const imgWrapper = imageContainer.createDiv({
                        cls: 'message-image-wrapper',
                        attr: {
                            style: 'width: 200px; height: 200px; position: relative; cursor: pointer;'
                        }
                    });

                    const img = imgWrapper.createEl('img', {
                        cls: 'message-image',
                        attr: {
                            src: `data:image/jpeg;base64,${base64Image}`,
                            style: 'width: 100%; height: 100%; object-fit: cover; border-radius: 4px;'
                        }
                    });

                    // 添加点击事件打开预览模态框
                    imgWrapper.addEventListener('click', () => {
                        new ImagePreviewModal(this.app, `data:image/jpeg;base64,${base64Image}`).open();
                    });
                });
            }
        }

        // 添加时间戳和复制按钮的容器
        const bottomContainer = messageEl.createDiv({ cls: 'message-bottom' });
        
        // 添加时间戳
        bottomContainer.createDiv({
            cls: 'timestamp',
            text: time.toLocaleTimeString()
        });

        // 添加复制按钮
        const copyBtn = bottomContainer.createEl('button', { cls: 'chat-ai-copy-button' }); // 修改这里：将复制按钮添加到 bottomContainer
        setIcon(copyBtn, 'copy');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.cleanTextContent(content));
            new Notice('已复制到剪贴板');
        });
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async callAI(userMessage, assistantMessageEl) {
        try {
            let apiKey = this.plugin.settings.currentApiKey || this.plugin.settings.apiKey[0];
            const keyMatch = apiKey.match(/.*?(sk-\S+)/);
            if (keyMatch) {
                apiKey = keyMatch[1];
            }

            let baseUrl = this.plugin.settings.currentBaseUrl.replace(/\/$/, '');
            const urlMatch = baseUrl.match(/(.*?)(https?:\/\/\S+)/);
            if (urlMatch) {
                baseUrl = urlMatch[2];
            }
            const apiUrl = `${baseUrl}/v1/chat/completions`;

            // 构建消息内容
            const messages = this.messages.map(m => {
                if (m.role === 'user' && m.images) {
                    // 如果是带图片的用户消息，构建多模态消息格式
                    const content = [];
                    content.push({
                        type: "text",
                        text: m.content
                    });
                    
                    // 添加图片，使用base64格式
                    m.images.forEach(base64Image => {
                        content.push({
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        });
                    });
                    
                    return {
                        role: m.role,
                        content: content
                    };
                } else {
                    // 普通文本消息
                    return {
                        role: m.role,
                        content: m.content
                    };
                }
            });

            // 添加当前消息
            if (this.pendingImages && this.pendingImages.length > 0) {
                // 如果有待发送的图片，构建多模态消息
                const content = [{
                    type: "text",
                    text: userMessage
                }];
                
                this.pendingImages.forEach(base64Image => {
                    content.push({
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`
                        }
                    });
                });
                
                messages.push({
                    role: "user",
                    content: content
                });
            } else {
                // 普通文本消息
                messages.push({
                    role: "user",
                    content: userMessage
                });
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: this.plugin.settings.currentModel,
                    messages: messages,
                    stream: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API请求失败: ${response.status} - ${response.statusText}\n${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            const contentContainer = assistantMessageEl.querySelector('.message-content');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.trim() === 'data: [DONE]') continue;
                    
                    try {
                        const jsonStr = line.replace(/^data: /, '');
                        const json = JSON.parse(jsonStr);
                        const content = json.choices[0]?.delta?.content || '';
                        
                        if (content) {
                            accumulatedContent += content;
                            // 使用 MarkdownRenderer 动态渲染累积的内容
                            contentContainer.empty();
                            await MarkdownRenderer.renderMarkdown(
                                accumulatedContent,
                                contentContainer,
                                this.plugin.app.workspace.getActiveFile()?.path || '',
                                this
                            );
                            this.scrollToBottom();
                        }
                    } catch (e) {
                        console.warn('解析流数据时出错:', e);
                    }
                }
            }

            // 更新消息数组中的内容
            const lastMessage = this.messages[this.messages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.content = accumulatedContent;
            }

            // 设置复制按钮事件
            const copyBtn = assistantMessageEl.querySelector('.chat-ai-copy-button');
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(this.cleanTextContent(accumulatedContent));
                new Notice('已复制到剪贴板');
            };

        } catch (error) {
            throw error;
        }
    }

    async onClose() {
        // 断开主题观察器
        if (this.themeObserver) {
            this.themeObserver.disconnect();
        }
        // 其他清理代码...
        this.containerEl.removeEventListener('wheel', this.handleWheel);
    }

    async updateDropdowns() {
        const baseUrlSelect = this.containerEl.querySelector('.header-dropdowns select:nth-child(1)');
        const apiKeySelect = this.containerEl.querySelector('.header-dropdowns select:nth-child(2)');
        const modelSelect = this.containerEl.querySelector('.header-dropdowns select:nth-child(3)');

        if (baseUrlSelect) {
            baseUrlSelect.innerHTML = '';
            this.plugin.settings.baseUrl.forEach(url => {
                const option = document.createElement('option');
                option.value = url.trim();
                option.text = url.trim();
                if (url === this.plugin.settings.currentBaseUrl) {
                    option.selected = true;
                }
                baseUrlSelect.appendChild(option);
            });
        }

        if (apiKeySelect) {
            apiKeySelect.innerHTML = '';
            this.plugin.settings.apiKey.forEach(key => {
                const match = key.match(/(.*?)(sk-\S+)/);
                const displayText = match
                    ? `${match[1].trim() || match[2].substring(0, 10)}...`
                    : key;
                const option = document.createElement('option');
                option.value = key;
                option.text = displayText;
                if (key === this.plugin.settings.currentApiKey) {
                    option.selected = true;
                }
                apiKeySelect.appendChild(option);
            });
        }

        if (modelSelect) {
            modelSelect.innerHTML = '';
            this.plugin.settings.model.forEach(model => {
                const option = document.createElement('option');
                option.value = model.trim();
                option.text = model.trim();
                if (model === this.plugin.settings.currentModel) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });
        }
    }

    // 监听主题变化
    registerThemeObserver() {
        // 创建观察器实例
        const observer = new MutationObserver(() => {
            // 当主题改变时，更新所有助手消息的样式
            const assistantMessages = this.containerEl.querySelectorAll('.chat-ai-message.assistant');
            assistantMessages.forEach(msg => {
                msg.style.background = getComputedStyle(document.body).getPropertyValue('--background-modifier-form-field');
                msg.style.color = getComputedStyle(document.body).getPropertyValue('--text-normal');
            });
        });

        // 始观察 body 的 class 变化
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        // 保存观察器实例以便后续清理
        this.themeObserver = observer;
    }

    // 新增：加载聊天历史
    async loadChatHistory() {
        console.log('开始加载聊天历史');
        try {
            const tempFile = this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.tempHistoryFile);
            if (tempFile instanceof TFile) {
                console.log('找到临时文件');
                const content = await this.plugin.app.vault.read(tempFile);
                this.plugin.settings.chatHistory = this.plugin.parseMarkdownToChatHistory(content);
                console.log('已加载聊天历史，消息数量:', this.plugin.settings.chatHistory.length);
                this.renderMessages();
                return;
            }
        } catch (error) {
            console.error('加载临时对话文件时出错:', error);
        }

        // 如果临时文件不存在或加载失败，创建空的临时文件
        try {
            console.log('创建新的临时文件');
            const historyFolderPath = 'A重要文件/ai历史记录';
            let folder = this.plugin.app.vault.getAbstractFileByPath(historyFolderPath);
            if (!(folder instanceof TFolder)) {
                folder = await this.plugin.app.vault.createFolder(historyFolderPath);
                console.log('创建历史记录文件夹');
            }
            await this.plugin.app.vault.create(this.plugin.settings.tempHistoryFile, '');
            this.plugin.settings.chatHistory = [];
            this.renderMessages();
            console.log('临时文件已创建');
        } catch (error) {
            // console.error('创建临时对话文件时出错:', error);
            // new Notice('创建临时对话文件时出错');
        }
    }

    // 新增：解析Markdown内容到chatHistory
    parseMarkdownToChatHistory(content) {
        const lines = content.split('\n');
        const chatHistory = [];
        let currentRole = null;
        let currentTime = null;
        let currentContent = [];

        lines.forEach(line => {
            const roleMatch = line.match(/^###\s*(你|AI)\s*\((\d{1,2}:\d{2}:\d{2})\)/);
            if (roleMatch) {
                // 保存之前的消息
                if (currentRole && currentContent.length > 0) {
                    chatHistory.push({
                        role: currentRole === '你' ? 'user' : 'assistant',
                        content: currentContent.join('\n'),
                        time: new Date(`1970-01-01T${currentTime}Z`) // 使用UTC时间
                    });
                }
                // 开始新的消息
                currentRole = roleMatch[1];
                currentTime = roleMatch[2];
                currentContent = [];
            } else {
                if (currentRole) {
                    currentContent.push(line);
                }
            }
        });

        // 保存最后一条消息
        if (currentRole && currentContent.length > 0) {
            chatHistory.push({
                role: currentRole === '你' ? 'user' : 'assistant',
                content: currentContent.join('\n'),
                time: new Date(`1970-01-01T${currentTime}Z`)
            });
        }

        return chatHistory;
    }

    // 新增：将chatHistory渲染到界面
    renderMessages() {
        console.log('开始渲染消息');
        this.messagesContainer.empty();
        this.messages = [...this.plugin.settings.chatHistory];
        console.log('要渲染的消息数量:', this.messages.length);
        this.messages.forEach(msg => {
            this.addMessage(msg.role, msg.content, msg.time, false);
        });
        console.log('消息渲染完成');
    }

    // 新增：将chatHistory保存为Markdown文件
    async saveChatHistoryToFile(chatHistory) {
        const historyFolderPath = 'A重要文件/ai历史记录';
        let folder = this.plugin.app.vault.getAbstractFileByPath(historyFolderPath);
        if (!(folder instanceof TFolder)) {
            // 创建文件夹
            folder = await this.plugin.app.vault.createFolder(historyFolderPath);
        }

        // 生成时间戳
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
        const filename = `${timestamp}.md`;
        const filePath = `${historyFolderPath}/${filename}`;

        // 格式化内容为Markdown
        let content = '';
        chatHistory.forEach(msg => {
            const timeStr = msg.time.toLocaleTimeString();
            const speaker = msg.role === 'user' ? '你' : 'AI';
            content += `### ${speaker} (${timeStr})\n\n${msg.content}\n\n`;
        });

        // 创建并写入文件
        await this.plugin.app.vault.create(filePath, content);

        // 更新当前历史文件路径
        this.plugin.settings.currentHistoryFile = filePath;
        await this.plugin.saveSettings();
    }

    // 新增：更新设置
    async updateSettings() {
        // 更新下拉菜单的值
        const baseUrlSelect = this.containerEl.querySelector('.header-dropdowns select:nth-child(1)');
        const apiKeySelect = this.containerEl.querySelector('.header-dropdowns select:nth-child(2)');
        const modelSelect = this.containerEl.querySelector('.header-dropdowns select:nth-child(3)');

        if (baseUrlSelect) {
            baseUrlSelect.value = this.plugin.settings.currentBaseUrl;
        }
        if (apiKeySelect) {
            apiKeySelect.value = this.plugin.settings.currentApiKey;
        }
        if (modelSelect) {
            modelSelect.value = this.plugin.settings.currentModel;
        }

        // 重新渲染下拉菜单选项
        await this.onOpen();
    }

    // 添加保存临时对话的方法
    async saveTempChatHistory() {
        const content = this.formatMessagesToMarkdown(this.messages);
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.tempHistoryFile);
            if (file instanceof TFile) {
                await this.plugin.app.vault.modify(file, content);
            } else {
                await this.plugin.app.vault.create(this.plugin.settings.tempHistoryFile, content);
            }
        } catch (error) {
            console.error('保存临时对话时出错:', error);
        }
    }

    // 添加格式化消息的方法
    formatMessagesToMarkdown(messages) {
        return messages.map(msg => {
            const timeStr = msg.time.toLocaleTimeString();
            const speaker = msg.role === 'user' ? '你' : 'AI';
            return `### ${speaker} (${timeStr})\n\n${msg.content}\n\n`;
        }).join('');
    }

    // 添加创建助手消息元素的方法
    createAssistantMessageElement() {
        const messageEl = this.messagesContainer.createDiv({ 
            cls: 'chat-ai-message',
            attr: {
                'data-role': 'assistant'  // 使用 data-role 属性而不是 class
            }
        });
        
        // 创建消息内容容器
        const contentContainer = messageEl.createDiv({ cls: 'message-content' });
        
        // 创建底部容器
        const bottomContainer = messageEl.createDiv({ cls: 'message-bottom' });
        
        // 添加时间戳
        bottomContainer.createDiv({
            cls: 'timestamp',
            text: new Date().toLocaleTimeString()
        });

        // 添加复制按钮
        const copyBtn = bottomContainer.createEl('button', { cls: 'chat-ai-copy-button' }); // 修改这里：将复制按钮添加到 bottomContainer
        setIcon(copyBtn, 'copy');
        
        this.messages.push({ 
            role: 'assistant', 
            content: '', 
            time: new Date() 
        });
        
        return messageEl;
    }

    // 添加图片上传相关方法
    initializeImageUpload() {
        // 创建隐藏的文件输入元素
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.multiple = true;
        this.fileInput.style.display = 'none';
        this.containerEl.appendChild(this.fileInput);

        // 初始化待发送的图片数组
        this.pendingImages = [];

        // 添加文件选择事件监听
        this.fileInput.addEventListener('change', async () => {
            const files = Array.from(this.fileInput.files);
            for (const file of files) {
                try {
                    const base64Image = await this.handleImageUpload(file);
                    this.pendingImages.push(base64Image);
                    this.addImagePreview(base64Image);
                } catch (error) {
                    new Notice(`上传图片失败: ${error.message}`);
                }
            }
            // 重置文件输入框的值，这样可以重复选择相同的文件
            this.fileInput.value = '';
        });

        // 添加粘贴事件监听
        this.textarea.addEventListener('paste', async (e) => {
            const items = Array.from(e.clipboardData.items);
            const imageItems = items.filter(item => item.type.startsWith('image/'));
            
            if (imageItems.length > 0) {
                e.preventDefault(); // 阻止默认粘贴行为
                
                for (const item of imageItems) {
                    const file = item.getAsFile();
                    try {
                        const base64Image = await this.handleImageUpload(file);
                        this.pendingImages.push(base64Image);
                        this.addImagePreview(base64Image);
                        // new Notice('图片已添加到候选区');
                    } catch (error) {
                        new Notice(`处理粘贴的图片失败: ${error.message}`);
                    }
                }
            }
        });

        // 添加拖放支持
        this.textarea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.textarea.style.border = '2px dashed var(--interactive-accent)';
        });

        this.textarea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.textarea.style.border = '1px solid var(--background-modifier-border)';
        });

        this.textarea.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.textarea.style.border = '1px solid var(--background-modifier-border)';

            const items = Array.from(e.dataTransfer.items);
            const files = Array.from(e.dataTransfer.files);
            
            // 处理拖放的文件
            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    try {
                        const base64Image = await this.handleImageUpload(file);
                        this.pendingImages.push(base64Image);
                        this.addImagePreview(base64Image);
                        new Notice('图片已添加到候选区');
                    } catch (error) {
                        new Notice(`处理拖放的图片失败: ${error.message}`);
                    }
                }
            }
        });
    }

    // 处理图片上传
    async handleImageUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // 获取base64字符串，移除开头的 "data:image/jpeg;base64," 等前缀
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }

    // 修改 addImagePreview 方法
    addImagePreview(base64Image) {
        // 确保预览区域可见并设置样式
        this.imagePreviewArea.style.display = 'flex';
        this.imagePreviewArea.style.flexWrap = 'wrap';
        this.imagePreviewArea.style.gap = '8px';
        this.imagePreviewArea.style.padding = '8px';
        this.imagePreviewArea.style.background = 'transparent';
        
        const previewContainer = this.imagePreviewArea.createDiv({
            cls: 'image-preview-container',
            attr: {
                style: 'position: relative; width: 100px; height: 100px; margin: 4px; background: transparent;'
            }
        });

        const img = previewContainer.createEl('img', {
            attr: {
                src: `data:image/jpeg;base64,${base64Image}`,
                style: 'width: 100%; height: 100%; object-fit: cover; border-radius: 4px; cursor: pointer;'
            }
        });

        // 添加点击事件
        img.addEventListener('click', () => {
            new ImagePreviewModal(this.app, `data:image/jpeg;base64,${base64Image}`).open();
        });

        const removeButton = previewContainer.createEl('button', {
            cls: 'remove-image-button',
            attr: {
                style: 'position: absolute; top: -8px; right: -8px; background: var(--background-modifier-error); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;'
            }
        });
        setIcon(removeButton, 'x');

        removeButton.addEventListener('click', () => {
            const index = this.pendingImages.indexOf(base64Image);
            if (index > -1) {
                this.pendingImages.splice(index, 1);
                previewContainer.remove();
                
                // 如果没有更多图片，完全隐藏预览区域并重置其内容
                if (this.pendingImages.length === 0) {
                    this.imagePreviewArea.style.display = 'none';
                    this.imagePreviewArea.empty(); // 清空预览区域的内容
                }
            }
        });
    }

    // 添加样式
    addStyle() {
        const style = document.createElement('style');
        style.textContent += `
            .chat-ai-upload-button {
                background: var(--background-modifier-border) !important;
                color: var(--text-normal);
                transition: all 0.2s ease;
                padding: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                cursor: pointer;
            }
            
            .chat-ai-upload-button:hover {
                background: var(--background-modifier-border-hover) !important;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .chat-ai-upload-button:active {
                transform: translateY(0);
                box-shadow: none;
            }
            
            .chat-ai-image-preview {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 8px;
                background: transparent;
                min-height: 50px;
                margin-bottom: 8px;
                width: 100%;
                box-sizing: border-box;
                border: none;
            }
            
            .image-preview-container {
                position: relative;
                width: 100px;
                height: 100px;
                border-radius: 4px;
                overflow: hidden;
                background: transparent;
                flex: 0 0 auto;
                box-shadow: none;
                border: none;
            }
            
            .image-preview-container img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 4px;
            }

            .remove-image-button {
                position: absolute;
                top: -8px;
                right: -8px;
                background: var(--background-modifier-error);
                color: white;
                border: none;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.8;
                transition: all 0.2s ease;
            }

            .remove-image-button:hover {
                opacity: 1;
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
    }

    // 添加一个新方法来更新专注模式
    async updateFocusMode() {
        if (this.plugin.settings.focusMode) {
            this.containerEl.addClass('focus-mode');
        } else {
            this.containerEl.removeClass('focus-mode');
        }
    }

    // 添加字体大小调整方法
    handleWheel(event) {
        if (event.ctrlKey) {
            event.preventDefault();
            const delta = event.deltaY > 0 ? -1 : 1;
            const newSize = Math.max(8, Math.min(32, (this.plugin.settings.fontSize || 14) + delta));
            
            if (newSize !== this.plugin.settings.fontSize) {
                this.plugin.settings.fontSize = newSize;
                this.applyFontSize();
                this.plugin.saveSettings();
            }
        }
    }

    // 应用字体大小
    applyFontSize() {
        const size = this.plugin.settings.fontSize;
        this.containerEl.style.setProperty('--chat-font-size', `${size}px`);
    }

    // 在 ChatView 类中添加一个清理文本的辅助方法
    cleanTextContent(text) {
        return text.trim().replace(/^\n+|\n+$/g, '');  // 移除开头和结尾的空行
    }
}

// 插件设置界面
class CallAIChatSettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async saveAndUpdateViews(newSettings) {
        // 更新设置
        Object.assign(this.plugin.settings, newSettings);
        await this.plugin.saveSettings();

        // 更新所有打开的聊天视图
        this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE).forEach(leaf => {
            if (leaf.view instanceof ChatView) {
                leaf.view.updateSettings();
            }
        });
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '对话AI 插件设置' });

        // API Key 设置
        new Setting(containerEl)
            .setName('API 密钥')
            .setDesc('选择或编辑你的 API 密钥列表')
            .addDropdown(dropdown => {
                this.apiKeyDropdown = dropdown;
                // 确保 apiKey 是数组
                if (!Array.isArray(this.plugin.settings.apiKey)) {
                    this.plugin.settings.apiKey = this.plugin.settings.apiKey.split('\n').filter(line => line.trim());
                }
                // 添加选项到下拉菜单
                this.plugin.settings.apiKey.forEach(line => {
                    const match = line.match(/(.*?)(sk-\S+)/);
                    if (match) {
                        const [_, note, key] = match;
                        const displayText = note.trim()
                            ? `${note.trim()} (${key.substring(0, 10)}...)`
                            : `${key.substring(0, 10)}...`;
                        dropdown.addOption(line.trim(), displayText);
                    } else {
                        dropdown.addOption(line.trim(), line.trim());
                    }
                });
                // 设置当前选中值
                if (this.plugin.settings.apiKey.length > 0) {
                    dropdown.setValue(this.plugin.settings.currentApiKey || this.plugin.settings.apiKey[0]);
                }
                // 处理选择变更
                dropdown.onChange(async (value) => {
                    await this.saveAndUpdateViews({ currentApiKey: value });
                });
            })
            .addButton(button => button
                .setButtonText('编辑列表')
                .onClick(() => {
                    const modal = new TextEditModal(
                        this.app,
                        '编辑 API 密钥列表',
                        Array.isArray(this.plugin.settings.apiKey)
                            ? this.plugin.settings.apiKey.join('\n')
                            : this.plugin.settings.apiKey,
                        async (result) => {
                            const apiKeys = result.split('\n').filter(line => line.trim());
                            await this.saveAndUpdateViews({
                                apiKey: apiKeys,
                                currentApiKey: apiKeys.length > 0 ? apiKeys[0] : ''
                            });
                            
                            // 更新所有打开的聊天视图
                            this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE).forEach(leaf => {
                                if (leaf.view instanceof ChatView) {
                                    leaf.view.onOpen(); // 重新加载整个视图
                                }
                            });
                            
                            this.display(); // 重新显示设置面板
                        }
                    );
                    modal.open();
                }));

        // Base URL 设置
        new Setting(containerEl)
            .setName('Base URL')
            .setDesc('选择或编辑API基础地址列表')
            .addDropdown(dropdown => {
                this.baseUrlDropdown = dropdown;
                // 确保 baseUrl 是数组
                if (!Array.isArray(this.plugin.settings.baseUrl)) {
                    this.plugin.settings.baseUrl = [this.plugin.settings.baseUrl];
                }
                this.plugin.settings.baseUrl.forEach(url => {
                    dropdown.addOption(url.trim(), url.trim());
                });
                dropdown.setValue(this.plugin.settings.currentBaseUrl)
                dropdown.onChange(async (value) => {
                    await this.saveAndUpdateViews({ currentBaseUrl: value });
                });
            })
            .addButton(button => button
                .setButtonText('编辑列表')
                .onClick(() => {
                    const modal = new TextEditModal(
                        this.app,
                        '编辑基础地址列表',
                        Array.isArray(this.plugin.settings.baseUrl)
                            ? this.plugin.settings.baseUrl.join('\n')
                            : this.plugin.settings.baseUrl,
                        async (result) => {
                            const urls = result.split('\n').filter(line => line.trim());
                            await this.saveAndUpdateViews({
                                baseUrl: urls,
                                currentBaseUrl: urls.length > 0 ? urls[0] : ''
                            });
                            this.display();
                        }
                    );
                    modal.open();
                }));

        // 模型名称设置
        new Setting(containerEl)
            .setName('模型名称')
            .setDesc('选择或编辑模型名称列表')
            .addDropdown(dropdown => {
                this.modelDropdown = dropdown;
                // 确保 model 是数组
                if (!Array.isArray(this.plugin.settings.model)) {
                    this.plugin.settings.model = [this.plugin.settings.model];
                }
                this.plugin.settings.model.forEach(model => {
                    dropdown.addOption(model.trim(), model.trim());
                });
                dropdown.setValue(this.plugin.settings.currentModel)
                dropdown.onChange(async (value) => {
                    await this.saveAndUpdateViews({ currentModel: value });
                });
            })
            .addButton(button => button
                .setButtonText('编辑列表')
                .onClick(() => {
                    const modal = new TextEditModal(
                        this.app,
                        '编辑模型名称列表',
                        Array.isArray(this.plugin.settings.model)
                            ? this.plugin.settings.model.join('\n')
                            : this.plugin.settings.model,
                        async (result) => {
                            const models = result.split('\n').filter(line => line.trim());
                            await this.saveAndUpdateViews({
                                model: models,
                                currentModel: models.length > 0 ? models[0] : ''
                            });
                            this.display();
                        }
                    );
                    modal.open();
                }));

        // 重置对话按钮
        new Setting(containerEl)
            .setName('重置对话')
            .setDesc('清除当前所有对话记录。')
            .addButton(button => button
                .setButtonText('重置')
                .setWarning()
                .onClick(() => {
                    if (confirm('确定要清除所有对话记录吗？')) {
                        this.plugin.clearChatHistory();
                        new Notice('对话记录已清除');
                    }
                }));

        // 新增设置选项：是否自动清空记录
        new Setting(containerEl)
            .setName('自动清空记录')
            .setDesc('每次重启面板时自动保存当前对话记录并清空对话窗口。')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoClearOnRestart)
                .onChange(async (value) => {
                    await this.saveAndUpdateViews({ autoClearOnRestart: value });
                }));

        // 添加自动聚焦设置
        new Setting(containerEl)
            .setName('自动聚焦')
            .setDesc('打开面板时自动聚焦到输入框')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoFocus)
                .onChange(async (value) => {
                    await this.saveAndUpdateViews({ autoFocus: value });
                }));

        // 新增专注模式开关
        new Setting(containerEl)
            .setName('专注模式')
            .setDesc('打开后，面板上方按钮和选择参数行只有在鼠标悬浮时才会显示。')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.focusMode)
                .onChange(async (value) => {
                    await this.saveAndUpdateViews({ focusMode: value });
                }));

        // 添加字体大小设置
        new Setting(containerEl)
            .setName('字体大小')
            .setDesc('设置对话界面的字体大小（也可以在对话界面使用 Ctrl + 滚轮调整）')
            .addSlider(slider => slider
                .setLimits(8, 32, 1)
                .setValue(this.plugin.settings.fontSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    await this.saveAndUpdateViews({ fontSize: value });
                }));

        // 添加历史记录路径设置
        new Setting(containerEl)
            .setName('历史记录路径')
            .setDesc('设置对话历史记录的存放路径（例如：AI/历史记录）')
            .addText(text => {
                text.setPlaceholder('输入历史记录存放路径')
                    .setValue(this.plugin.settings.historyPath)
                    .onChange(async (value) => {
                        // 移除开头的斜杠
                        value = value.replace(/^\/+/, '');
                        // 移除结尾的斜杠
                        value = value.replace(/\/+$/, '');
                        
                        this.plugin.settings.historyPath = value;
                        // 更新临时文件路径
                        this.plugin.settings.tempHistoryFile = value ? `${value}/临时对话.md` : '';
                        await this.plugin.saveSettings();
                        
                        // 确保文件夹存在
                        if (value) {
                            try {
                                const folder = this.plugin.app.vault.getAbstractFileByPath(value);
                                if (!(folder instanceof TFolder)) {
                                    await this.plugin.app.vault.createFolder(value);
                                }
                            } catch (error) {
                                console.error('创建历史记录文件夹失败:', error);
                                new Notice('创建历史记录文件夹失败，请检查路径是否合法');
                            }
                        }
                    });
            })
            .addExtraButton(button => {
                button
                    .setIcon('folder')
                    .setTooltip('选择文件夹')
                    .onClick(async () => {
                        // 创建文件夹选择模态框
                        new FolderSuggestModal(this.app, async (folder) => {
                            const path = folder.path;
                            this.plugin.settings.historyPath = path;
                            this.plugin.settings.tempHistoryFile = `${path}/临时对话.md`;
                            await this.plugin.saveSettings();
                            this.display(); // 这里保持 display，因为 SettingsTab 类中有这个方法
                        }).open();
                    });
            });
    }
}

// 主插件类
module.exports = class CallAIChatPlugin extends Plugin {
    async onload() {
        // 加载和应用默认设置
        await this.loadSettings();
    
        // 注册自定义视图
        this.registerView(
            CHAT_VIEW_TYPE,
            (leaf) => new ChatView(leaf, this)
        );
    
        // 添加命令：打开对话AI
        this.addCommand({
            id: 'open-chat-ai',
            name: '打开对话AI',
            callback: () => {
                this.activateChatView();
            },
        });
    
        // 新增命令：快速唤醒ai
        this.addCommand({
            id: 'quick-wake-ai',
            name: '快速唤醒ai',
            callback: async () => {
                // 打开一个新的悬浮窗口作为 popout
                const popoutLeaf = this.app.workspace.openPopoutLeaf();
        
                // 设置视图类型为自定义的 CHAT_VIEW_TYPE
                await popoutLeaf.setViewState({ type: CHAT_VIEW_TYPE });
        
                // 将该对话面板置顶固定
                popoutLeaf.setPinned(true);
        
                // 显示该弹出叶子窗口
                this.app.workspace.revealLeaf(popoutLeaf);
        
                // 获取已加载的 ChatView 实例，并自动聚焦到输入框
                const view = popoutLeaf.view;
                if (view && view.textarea && this.settings.autoFocus) {
                    view.textarea.focus();
                }
            },
        }); 
    
        // 添加设置选项卡
        this.addSettingTab(new CallAIChatSettingsTab(this.app, this));
    
        // 添加样式
        this.addStyle();

        // 添加快捷键命令：恢复更早的对话记录
        this.addCommand({
            id: 'restore-previous-chat',
            name: '恢复更早的对话记录',
            hotkeys: [{ modifiers: ['Alt'], key: 'ArrowUp' }],
            callback: async () => {
                const files = await this.getHistoryFiles();
                if (files.length === 0) {
                    new Notice('没有找到历史对话记录');
                    return;
                }

                const currentIndex = files.findIndex(f => f.path === this.settings.currentHistoryFile);
                const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, files.length - 1);
                
                if (nextIndex !== currentIndex) {
                    await this.loadHistoryFile(files[nextIndex]);
                } else {
                    new Notice('已经是最早的对话记录了');
                }
            }
        });

        // 添加快捷键命令：恢复更新的对话记录
        this.addCommand({
            id: 'restore-next-chat',
            name: '恢复更新的对话记录',
            hotkeys: [{ modifiers: ['Alt'], key: 'ArrowDown' }],
            callback: async () => {
                const files = await this.getHistoryFiles();
                if (files.length === 0) {
                    new Notice('没有找到历史对话记录');
                    return;
                }

                const currentIndex = files.findIndex(f => f.path === this.settings.currentHistoryFile);
                const nextIndex = currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0);
                
                if (nextIndex !== currentIndex) {
                    await this.loadHistoryFile(files[nextIndex]);
                } else {
                    new Notice('已经是最新的对话记录了');
                }
            }
        });

        // 在 onload() 方法中添加新命令，在其他命令的注册之后
        this.addCommand({
            id: 'quick-new-chat',
            name: '快速新建',
            callback: async () => {
                // 获取所有打开的聊天视图
                const chatLeaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
                
                if (chatLeaves.length > 0) {
                    // 如果有打开的聊天视图，对每个视图执行新建操作
                    for (const leaf of chatLeaves) {
                        const view = leaf.view;
                        if (view instanceof ChatView) {
                            await view.handleNewConversation();
                        }
                    }
                } else {
                    // 如果没有打开的聊天视图，先打开一个新的视图
                    const leaf = await this.activateChatView();
                    // 等待视图加载完成后执行新建操作
                    setTimeout(async () => {
                        const view = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0]?.view;
                        if (view instanceof ChatView) {
                            await view.handleNewConversation();
                        }
                    }, 100);
                }
            }
        });
    }

    onunload() {
        // 插件卸载时的清理
        this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE).forEach((leaf) => leaf.detach());
    }

    async activateChatView() {
        let leaf = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];
        if (!leaf) {
            leaf = this.app.workspace.getRightLeaf(false);
            await leaf.setViewState({ type: CHAT_VIEW_TYPE });
        }
        this.app.workspace.revealLeaf(leaf);
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        
        // 确保历史记录路径格式正确
        if (this.settings.historyPath) {
            this.settings.historyPath = this.settings.historyPath.replace(/^\/+/, '').replace(/\/+$/, '');
            this.settings.tempHistoryFile = `${this.settings.historyPath}/临时对话.md`;
        }
        
        // 确保所有设置项都是数组格式
        if (!Array.isArray(this.settings.apiKey)) {
            this.settings.apiKey = [this.settings.apiKey].filter(k => k);
        }
        if (!Array.isArray(this.settings.baseUrl)) {
            this.settings.baseUrl = [this.settings.baseUrl].filter(u => u);
        }
        if (!Array.isArray(this.settings.model)) {
            this.settings.model = [this.settings.model].filter(m => m);
        }
        // 设置当前选中的值
        if (!this.settings.currentApiKey && this.settings.apiKey.length > 0) {
            this.settings.currentApiKey = this.settings.apiKey[0];
        }
        if (!this.settings.currentBaseUrl && this.settings.baseUrl.length > 0) {
            this.settings.currentBaseUrl = this.settings.baseUrl[0];
        }
        if (!this.settings.currentModel && this.settings.model.length > 0) {
            this.settings.currentModel = this.settings.model[0];
        }
        if (!this.settings.chatHistory) {
            this.settings.chatHistory = [];
        }
        if (!this.settings.currentHistoryFile) {
            this.settings.currentHistoryFile = '';
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // 在保存设置后更新所有打开的对话视图
        this.updateAllChatViews();
    }

    updateAllChatViews() {
        this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE).forEach(leaf => {
            if (leaf.view instanceof ChatView) {
                leaf.view.updateDropdowns();
            }
        });
    }

    clearChatHistory() {
        this.settings.chatHistory = [];
        this.settings.currentHistoryFile = '';
        this.saveSettings();
        // 重新加载所有 ChatView 实例的消息
        this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE).forEach(leaf => {
            const view = leaf.view;
            if (view instanceof ChatView) {
                view.messages = [];
                view.messagesContainer.empty();
            }
        });
    }

    addStyle() {
        // 这里可以添加全局样式，如果需要的话
    }

    // 新增：保存聊天历史到文件
    async saveChatHistoryToFile(chatHistory) {
        if (!this.settings.historyPath) {
            new Notice('请先在设置中配置历史记录存放路径');
            return;
        }

        let folder = this.app.vault.getAbstractFileByPath(this.settings.historyPath);
        if (!(folder instanceof TFolder)) {
            try {
                folder = await this.app.vault.createFolder(this.settings.historyPath);
            } catch (error) {
                console.error('创建历史记录文件夹失败:', error);
                new Notice('创建历史记录文件夹失败，请检查路径是否合法');
                return;
            }
        }

        // 生成时间戳
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
        const filename = `${timestamp}.md`;
        const filePath = `${this.settings.historyPath}/${filename}`;

        // 格式化内容为Markdown
        let content = '';
        chatHistory.forEach(msg => {
            const timeStr = msg.time.toLocaleTimeString();
            const speaker = msg.role === 'user' ? '你' : 'AI';
            content += `### ${speaker} (${timeStr})\n\n${msg.content}\n\n`;
        });

        // 创建并写入文件
        await this.app.vault.create(filePath, content);

        // 更新当前历史文件路径
        this.settings.currentHistoryFile = filePath;
        await this.saveSettings();
    }

    // 新增：加载最新聊天历史文件
    async loadLatestChatHistory() {
        const historyFolderPath = 'A重要文件/ai历史记录';
        let folder = this.app.vault.getAbstractFileByPath(historyFolderPath);
        if (!(folder instanceof TFolder)) {
            // 文件夹不存在，创建它
            folder = await this.app.vault.createFolder(historyFolderPath);
            this.settings.chatHistory = [];
            await this.saveSettings();
            return;
        }

        const files = this.app.vault.getFiles().filter(file => file.path.startsWith(historyFolderPath) && file.extension === 'md');
        if (files.length === 0) {
            // 没���历史文件，开始新的对话
            this.settings.chatHistory = [];
            await this.saveSettings();
            return;
        }

        // 按照修改时间降序排序，获取最新的文件
        files.sort((a, b) => b.stat.mtime - a.stat.mtime);
        const latestFile = files[0];
        try {
            const content = await this.app.vault.read(latestFile);
            this.settings.currentHistoryFile = latestFile.path;
            this.settings.chatHistory = this.parseMarkdownToChatHistory(content);
            await this.saveSettings();
        } catch (error) {
            console.error('加载最新历史文件时出错:', error);
            new Notice('加载历史对话时出错');
            this.settings.chatHistory = [];
            await this.saveSettings();
        }
    }

    // 新增：解析Markdown内容到chatHistory
    parseMarkdownToChatHistory(content) {
        const lines = content.split('\n');
        const chatHistory = [];
        let currentRole = null;
        let currentTime = null;
        let currentContent = [];

        lines.forEach(line => {
            const roleMatch = line.match(/^###\s*(你|AI)\s*\((\d{1,2}:\d{2}:\d{2})\)/);
            if (roleMatch) {
                // 保存之前的消息
                if (currentRole && currentContent.length > 0) {
                    chatHistory.push({
                        role: currentRole === '你' ? 'user' : 'assistant',
                        content: currentContent.join('\n'),
                        time: new Date(`1970-01-01T${currentTime}Z`) // 使用UTC时间
                    });
                }
                // 开始新的消息
                currentRole = roleMatch[1];
                currentTime = roleMatch[2];
                currentContent = [];
            } else {
                if (currentRole) {
                    currentContent.push(line);
                }
            }
        });

        // 保存最后一条消息
        if (currentRole && currentContent.length > 0) {
            chatHistory.push({
                role: currentRole === '你' ? 'user' : 'assistant',
                content: currentContent.join('\n'),
                time: new Date(`1970-01-01T${currentTime}Z`)
            });
        }

        return chatHistory;
    }

    // 添加新方法用于获取历史文件列表
    async getHistoryFiles() {
        if (!this.settings.historyPath) {
            return [];
        }

        const folder = this.app.vault.getAbstractFileByPath(this.settings.historyPath);
        if (!(folder instanceof TFolder)) {
            return [];
        }

        const files = this.app.vault.getFiles()
            .filter(file => file.path.startsWith(this.settings.historyPath) && file.extension === 'md')
            .sort((a, b) => b.stat.mtime - a.stat.mtime);

        return files;
    }

    // 添加新方法用于加载指定的历史文件
    async loadHistoryFile(file) {
        try {
            const content = await this.app.vault.read(file);
            this.settings.currentHistoryFile = file.path;
            this.settings.chatHistory = this.parseMarkdownToChatHistory(content);
            await this.saveSettings();

            // 更新所有打开的聊天视图
            this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE).forEach(leaf => {
                if (leaf.view instanceof ChatView) {
                    leaf.view.messages = [...this.settings.chatHistory];
                    leaf.view.renderMessages();
                }
            });

            new Notice(`已恢复 ${file.basename} 的对话记录`);
        } catch (error) {
            console.error('加载历史文件时出错:', error);
            new Notice('加载历史对话时出错');
        }
    }
}

// 添加样式
const style = document.createElement('style');
style.textContent = `
    /* 修改专注模式样式 */
    .focus-mode .nav-header,
    .focus-mode .nav-buttons-container,
    .focus-mode .header-dropdowns,
    .focus-mode .nav-header *,
    .focus-mode .nav-buttons-container *,
    .focus-mode .header-dropdowns * {
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    }

    .focus-mode .nav-header:hover,
    .focus-mode .nav-buttons-container:hover,
    .focus-mode .header-dropdowns:hover,
    .focus-mode .nav-header:hover *,
    .focus-mode .nav-buttons-container:hover *,
    .focus-mode .header-dropdowns:hover * {
        opacity: 1;
        pointer-events: auto;
    }

    /* 确保整个header区域都能触发hover效果 */
    .focus-mode .nav-header,
    .focus-mode .nav-buttons-container,
    .focus-mode .header-dropdowns {
        pointer-events: auto;
    }

    /* 现有样式... */
    
    .chat-ai-container {
        font-size: var(--chat-font-size, 14px);
    }
    
    .chat-ai-message {
        font-size: var(--chat-font-size, 14px);
    }
    
    .chat-ai-textarea {
        font-size: var(--chat-font-size, 14px);
    }

    .chat-ai-container {
        background-color: var(--background-primary);
        color: var(--text-normal);
    }

    .chat-ai-messages {
        background-color: var(--background-primary);
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .chat-ai-message {
        background-color: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
    }

    .chat-ai-message.user {
        background-color: var(--background-secondary-alt);
    }

    .chat-ai-message.assistant {
        background-color: var(--background-primary-alt);
    }

    .chat-ai-input-area {
        background-color: var(--background-primary);
        border-top: 1px solid var(--divider-color);
    }

    .chat-ai-textarea {
        background-color: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
    }

    .chat-ai-textarea:focus {
        border-color: var(--interactive-accent);
        box-shadow: 0 0 0 2px var(--background-modifier-border-hover);
    }

    .chat-ai-send-button {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
    }

    .chat-ai-send-button:hover {
        background-color: var(--interactive-accent-hover);
    }

    .chat-ai-header {
        background-color: var(--background-primary);
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .chat-ai-header-button {
        background-color: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
    }

    .chat-ai-header-button:hover {
        background-color: var(--background-modifier-hover);
    }

    .header-dropdowns select {
        background-color: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
    }

    .header-dropdowns select:hover {
        background-color: var(--background-modifier-hover);
    }

    .chat-ai-image-preview {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px;
        background: transparent;
        min-height: 50px;
        margin-bottom: 8px;
        width: 100%;
        box-sizing: border-box;
        border: none;
    }

    .chat-ai-upload-button {
        background-color: var(--interactive-accent) !important;
        color: var(--text-on-accent);
    }

    .chat-ai-upload-button:hover {
        background-color: var(--interactive-accent-hover) !important;
    }

    pre.code-block {
        background-color: var(--code-background);
        border: 1px solid var(--background-modifier-border);
    }

    .code-copy-button {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
    }

    .code-copy-button:hover {
        background-color: var(--interactive-accent-hover);
    }

    .select-tooltip {
        background-color: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
    }

    /* ... 其他样式保持不变 ... */

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--background-primary); // 整个面板使用主背景色
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .view-header {
        flex: 0 0 var(--header-height);
        border-bottom: 1px solid var(--divider-color);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 8px;
        background: transparent; // 移除背景色，使用父元素背景
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .view-header-title-container {
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        min-width: 0;
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .view-header-title {
        font-size: var(--font-ui-medium);
        font-weight: var(--font-medium);
        color: var(--text-normal);
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-messages {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 16px;
        background: transparent; // 移除背景色，使用父元素背景
        position: relative;
    }

    /* 输入区域容器样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-input-area {
        flex: 0 0 120px !important; // 使用 !important 确保高度固定
        border-top: 1px solid var(--divider-color);
        background: transparent;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        height: 120px !important; // 使用固定高度
        min-height: 120px !important;
        max-height: 120px !important;
        box-sizing: border-box;
        overflow: hidden; // 防止内容溢出
    }

    /* 输入框样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-textarea {
        width: 100%;
        resize: none;
        background-color: rgba(var(--background-primary-rgb), 0.2);
        color: var(--text-normal);
        border: var(--input-border-width) solid var(--background-modifier-border);
        border-radius: var(--radius-s);
        padding: 8px 12px;
        line-height: 1.5;
        height: 80px !important; // 使用固定高度
        max-height: 80px !important;
        min-height: 80px !important;
        box-sizing: border-box;
        overflow-y: auto;
        font-size: inherit; // 继承父元素的字体大小
    }

    /* 按钮容器样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .input-button-container {
        flex: 0 0 32px; // 固定高度
        display: flex;
        gap: 8px;
        height: 32px !important;
    }

    /* 添加占位符文本的样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-textarea::placeholder {
        color: var(--text-muted);
        opacity: 0.6;
        font-weight: 400;
    }

    /* 输入框焦点状态 - 只改变边框和阴影 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-textarea:focus {
        border-color: var(--interactive-accent);
        box-shadow: 0 0 0 2px var(--background-modifier-border-hover);
    }

    /* 输入框悬停状态 - 只改变边框 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-textarea:hover {
        border-color: var(--background-modifier-border-hover);
    }

    /* 基础消息样式 - 所有消息共用 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-message {
        background-color: rgba(var(--background-primary-alt-rgb), 0.3);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--background-modifier-border);
        border-radius: var(--radius-m);
        padding: 8px 12px 24px 12px;
        margin-bottom: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        position: relative;
        max-width: 85%;
        width: max-content;
        min-width: 2em;
        margin-left: 8px;
        margin-right: auto;
    }

    /* 用户消息位置样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-message[data-role="user"] {
        margin-left: auto;
        margin-right: 8px;
    }

    /* 助手消息位置样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-message[data-role="assistant"] {
        margin-left: 8px;
        margin-right: auto;
    }

    /* 消息内容文字样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-message .message-content {
        color: var(--text-normal);
        word-break: break-word;
    }

    /* 为亮色模式单独设置颜色 */
    body:not(.theme-dark) .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-message .message-content {
        color: #000000; /* 亮色模式下使用纯黑色 */
    }

    /* 时间戳和复制按钮容器 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .message-bottom {
        display: flex;
        justify-content: flex-end; // 右对齐
        align-items: center;
        gap: 8px; // 添加间距
        position: absolute; // 绝对定位
        bottom: 2px; // 进一步减小底部距离
        right: 12px; // 距离右侧12px
    }

    /* 时间戳样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .timestamp {
        font-size: 0.8em;
        opacity: 0.4; // 降低透明度，使颜色更淡
        color: var(--text-faint); // 使用更淡的文本颜色
    }

    /* 复制按钮样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-copy-button {
        opacity: 0; // 默认完全隐藏
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: opacity 200ms ease;
        padding: 0;
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-copy-button svg {
        width: 14px;
        height: 14px;
    }

    /* 鼠标悬停在消息容器上时显示复制按钮 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-message:hover .chat-ai-copy-button {
        opacity: 0.5;
    }

    /* 鼠标悬停在复制按钮上时的样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-copy-button:hover {
        opacity: 0.8;
    }

    /* 滚动条样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] ::-webkit-scrollbar {
        width: var(--scrollbar-width);
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] ::-webkit-scrollbar-thumb {
        background-color: var(--scrollbar-thumb-bg);
        border: var(--scrollbar-thumb-border-width) solid transparent;
        border-radius: var(--scrollbar-thumb-radius);
        background-clip: padding-box;
    }

    /* 按钮样式统一 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-header-button {
        background-color: var(--interactive-normal);
        color: var(--text-normal);
        border: none;
        border-radius: var(--radius-s);
        padding: 4px 8px;
        font-size: var(--font-ui-smaller);
        cursor: pointer;
        transition: background-color 0.1s ease;
        opacity: 0.6; // 添加60%透明度
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-send-button {
        background-color: var(--interactive-normal);
        color: var(--text-normal);
        border: none;
        border-radius: var(--radius-s);
        padding: 4px 8px;
        font-size: var(--font-ui-smaller);
        cursor: pointer;
        transition: background-color 0.1s ease;
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-header-button:hover,
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-send-button:hover {
        background-color: var(--interactive-hover);
    }

    /* 下拉菜单样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .header-dropdowns select {
        background-color: var(--background-primary);
        color: var(--text-normal);
        border: var(--input-border-width) solid var(--background-modifier-border);
        border-radius: var(--radius-s);
        padding: 2px 4px;
        font-size: var(--font-ui-smaller);
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .header-dropdowns select:hover {
        background-color: var(--background-modifier-form-field-highlighted);
    }

    /* 复制按钮样式调整 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-copy-button {
        opacity: 0.5; // 添加50%透明度
        width: 16px; // 缩小按钮大小
        height: 16px; // 缩小按钮大小
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        cursor: pointer;
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-copy-button svg {
        width: 14px; // 缩小图标大小
        height: 14px; // 缩小图标大小
    }

    /* 输入框样式调整 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-textarea {
        width: 100%;
        resize: none;
        background-color: rgba(var(--background-primary-rgb), 0.2);
        color: var(--text-normal);  // 保持文字颜色完全不透明
        border: var(--input-border-width) solid var(--background-modifier-border);
        border-radius: var(--radius-s);
        padding: 8px 12px;
        line-height: var(--line-height-tight);
        min-height: 40px;
        /* 删除整体opacity设置 */
    }

    /* 发送和图片上传按钮样式调整 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-send-button,
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-upload-button {
        background-color: var(--interactive-normal);
        color: var(--text-normal);
        border: none;
        border-radius: var(--radius-s);
        padding: 4px 8px;
        font-size: var(--font-ui-smaller);
        cursor: pointer;
        transition: background-color 0.1s ease;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.5; // 添加50%透明度
    }

    /* 图片上传按钮图标大小 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-upload-button svg {
        width: 16px;
        height: 16px;
    }

    /* 添加暗色模式特定样式 */
    .theme-dark .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-textarea {
        background-color: var(--background-primary);  /* 在暗色模式下使用主背景色 */
        opacity: 0.7;  /* 降低不透明度使其更暗 */
    }

    /* 按钮基础样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-header-button,
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-send-button {
        background-color: rgba(var(--background-primary-rgb), 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(var(--background-primary-rgb), 0.1);
        color: var(--text-normal);
        border-radius: var(--radius-s);
        padding: 4px 8px;
        font-size: var(--font-ui-smaller);
        cursor: pointer;
        transition: all 0.2s ease;
        opacity: 0.8;
    }

    /* 按钮悬停效果 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-header-button:hover,
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-send-button:hover {
        background-color: rgba(var(--background-primary-rgb), 0.3);
        opacity: 1;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* 下拉菜单样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .header-dropdowns select {
        background-color: rgba(var(--background-primary-rgb), 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: var(--text-normal);
        border: 1px solid rgba(var(--background-primary-rgb), 0.1);
        border-radius: var(--radius-s);
        padding: 4px 8px;
        font-size: var(--font-ui-smaller);
        cursor: pointer;
        transition: all 0.2s ease;
        opacity: 0.8;
    }

    /* 下拉菜单悬停效果 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .header-dropdowns select:hover {
        background-color: rgba(var(--background-primary-rgb), 0.3);
        opacity: 1;
    }

    /* 下拉菜单选项样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .header-dropdowns select option {
        background-color: var(--background-primary);
        color: var(--text-normal);
        padding: 8px;
    }

    /* 图片上传按钮样式 */
    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-upload-button {
        background-color: rgba(var(--background-primary-rgb), 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(var(--background-primary-rgb), 0.1);
        opacity: 0.8;
        transition: all 0.2s ease;
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-upload-button:hover {
        background-color: rgba(var(--background-primary-rgb), 0.3);
        opacity: 1;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .workspace-leaf-content[data-type="${CHAT_VIEW_TYPE}"] .chat-ai-image-preview {
        border: none !important;
        background: transparent !important;
    }

    /* 图片预览模态框样式 */
    .image-preview-modal-container {
        background: var(--background-primary);
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .image-preview-modal-img {
        transition: all 0.3s ease;
    }

    .image-preview-modal-close {
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }

    .image-preview-modal-close:hover {
        opacity: 1;
    }

    /* 消息中的图片容器样式 */
    .message-image-wrapper {
        overflow: hidden;
        transition: transform 0.2s ease;
    }

    .message-image-wrapper:hover {
        transform: scale(1.02);
    }

    .message-image {
        transition: transform 0.2s ease;
    }

    .message-image:hover {
        transform: scale(1.05);
    }
`;

// 将样式添加到文档头部
document.head.appendChild(style);

// 在样式开始处添加 CSS 变量
document.body.style.setProperty('--background-primary-rgb', '255, 255, 255'); // 亮色主题
// 或者根据当前主题动态设置

// 在样式开始处添加这个变量定义
document.body.style.setProperty('--background-secondary-alt-rgb', '240, 240, 240'); // 浅色主题
// 如果是深色主题可以使用不同的RGB值

// 在 DEFAULT_SETTINGS 后添加图片预览模态框类
class ImagePreviewModal extends Modal {
    constructor(app, imageUrl) {
        super(app);
        this.imageUrl = imageUrl;
    }

    onOpen() {
        const {contentEl} = this;
        
        // 创建图片容器
        const imageContainer = contentEl.createDiv({
            cls: 'image-preview-modal-container',
            attr: {
                style: `
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 200px;
                    max-height: 80vh;
                    position: relative;
                `
            }
        });

        // 创建图片元素
        const img = imageContainer.createEl('img', {
            cls: 'image-preview-modal-img',
            attr: {
                src: this.imageUrl,
                style: `
                    max-width: 100%;
                    max-height: 80vh;
                    object-fit: contain;
                    cursor: zoom-in;
                `
            }
        });

        // 添加缩放功能
        let isZoomed = false;
        img.addEventListener('click', () => {
            isZoomed = !isZoomed;
            if (isZoomed) {
                img.style.maxHeight = 'none';
                img.style.maxWidth = 'none';
                img.style.cursor = 'zoom-out';
            } else {
                img.style.maxHeight = '80vh';
                img.style.maxWidth = '100%';
                img.style.cursor = 'zoom-in';
            }
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
