const fs = require('fs');
const path = require('path');
const token = require('./token');

const commonKey = ['background', 'font-color', 'border']
const Theme = token["cabin x theme"]
const commonTemplate = (currentKey) => {
    return `\n/* ----------- ${currentKey} -----------*/\n`
}

const valueReg = 'cabin x theme.cabin x.'

const prefix = 'dm'
const PaletteTokenPrefix = `--${prefix}-token`
const CommonVarPrefix = `--${prefix}-common`
const ComponentPrefix = `--${prefix}-component`

/**
 * 扁平化对象
 * @param obj
 * @param targetKey
 * @param parentKey
 * @param separator
 * @returns {{}}
 */
const flattenObject = (obj, targetKey = 'value', parentKey = '', separator = '-') => {
    const result = {};
    let newKey = parentKey
    if (obj[targetKey] !== undefined) {

        result[newKey] = obj[targetKey];
    } else {
        for (const key in obj) {
            newKey = parentKey ? parentKey + separator + key : key;
            if (typeof obj[key] === 'object') {
                const nestedObject = flattenObject(obj[key], targetKey, newKey, separator);
                Object.assign(result, nestedObject);
            }
        }
    }

    return result;
}

/**
 * 写文件
 * @param filePath
 * @param content
 * @returns {Promise<unknown>}
 */
const writeFile = (filePath, content) => {
    return new Promise((resolve, reject) => {
        try {
            const directoryPath = path.dirname(filePath)
            if (!fs.existsSync(directoryPath)) {
                // 如果目录不存在，使用 fs.mkdirSync 创建它
                fs.mkdirSync(directoryPath, {recursive: true}); // 使用 { recursive: true } 可以创建多层目录
            }
            fs.writeFile(filePath, content, (err) => {
                if (err) {
                    reject(false)
                }
                resolve(true)
            })
        } catch (e) {
            reject(false)
        }
    })
}

/**
 * 格式化 色板
 * @param theme
 * @returns {{}}
 */
const formatPaletteJsonToCssVarJson = (theme) => {
    const palette = theme.palette;
    return flattenObject(palette, 'value', `${PaletteTokenPrefix}-palette`);
}

/**
 * 格式化 公共变量
 * @param theme
 * @returns {{}}
 */
const formatCommonVarJsonToCssVarJson = (theme) => {
    let comData = {};
    commonKey.forEach((key) => {
        Object.keys(theme[key]).forEach((key2) => {
            comData = {...comData, ...flattenObject(theme[key][key2], 'value', `${CommonVarPrefix}-${key}-${key2}`)}
        })

    })
    return comData;
}

/**
 * 格式化 组件变量
 * @param theme
 * @returns {{}}
 */
const formatComponentVarJsonToCssVarJson = (theme) => {
    let components = theme.components;
    return flattenObject(components, 'value', `${ComponentPrefix}`);

}

/**
 * 获取字体大小和行高
 * 默认使用默认值即可
 * @returns {{"--cx-font-size-l-default": string, "--cx-font-size-m-default": string, "--cx-font-size-l-default-line-height": string, "--cx-font-size-s-default": string, "--cx-font-size-m-default-line-height": string, "--cx-font-size-s-default-line-height": string}}
 */
const getFontSizeAndLineHeight = ({
                                      fontSizeS = 12,
                                      fontSizeM = 14,
                                      fontSizeL = 16,
                                      lineHeightS = 18,
                                      lineHeightM = 22,
                                      lineHeightL = 24
                                  }) => {
    return {
        //font-size
        "--cx-font-size-s-default": `${fontSizeS}`, //small尺寸(三个尺寸中)默认字号
        "--cx-font-size-m-default": `${fontSizeM}`, //normal尺寸(三个尺寸中)默认字号
        "--cx-font-size-l-default": `${fontSizeL}`, //large尺寸(三个尺寸中)默认字号

        //line-height
        "--cx-font-size-s-default-line-height": `${lineHeightS}`,
        "--cx-font-size-m-default-line-height": `${lineHeightM}`,
        "--cx-font-size-l-default-line-height": `${lineHeightL}`
    }
}


const writeComponentFile = async (name, data) => {
    await writeFile(`./components/${name}.scss`, data.str)
    await writeFile(`./components/${name}.json`, JSON.stringify(data.data))
}

const writePaletteFile = async (name, data) => {
    await writeFile(`./palette/${name}.scss`, data.str)
    await writeFile(`./palette/${name}.json`, JSON.stringify(data.data))
}

/**
 * json 转 css var
 * @param json
 * @param prefixType
 * @returns {{str: string, data: {}}}
 */
const jsonToCssVar = (json, prefixType = '',) => {
    let str = '';
    let lastKey = '';
    let lastComponentName = '';
    let prefixMap = {
        palette: PaletteTokenPrefix,
        common: CommonVarPrefix,
        both: ComponentPrefix
    }
    let keyPrefix = prefixMap[prefixType];
    let data = {};

    Object.keys(json).forEach((key) => {
        let currentKey = key.replace(keyPrefix, '');
        /* -type-name-step */
        currentKey = currentKey.split('-')[1];
        // 组件
        if (prefixType === 'both' && currentKey !== lastComponentName) {
            str += commonTemplate(currentKey);
            lastComponentName = currentKey;
        }
        // 普通
        currentKey = key.replace(keyPrefix, '').split('-')[2];
        if (currentKey !== lastKey && keyPrefix) {
            str += commonTemplate(currentKey);
            lastKey = currentKey;
        }

        // 如果是number 则+px
        if (typeof json[key] === 'number') {
            json[key] = `${json[key]}px`;
            data[key] = `${json[key]}px`;
        }
        //  {cabin x theme.cabin x.palette.gray.20}
        if (json[key].includes(valueReg)) {
            const reg = new RegExp(valueReg, 'g');
            let valueKey = json[key].replace(/{|}/g, '').replace(reg, '').replace(/\./g, '-');
            let prefix = valueKey.startsWith('palette') ? prefixMap.palette : prefixMap.common;

            if (prefixType !== 'both' || valueKey.split('-')[0] === 'palette') {
                prefix = prefixMap.palette;
            }

            json[key] = `var(${prefix}-${valueKey})`;
            data[key] = `${prefix}-${valueKey}`;
        }else {
            data[key] = `${json[key]}`;
        }
        str += `${key}: ${json[key]};\n`
    })
    return {str, data};
}


/**
 * 组合公共变量
 * @param palette
 * @param common
 * @param fontSize
 * @returns
 */
const comboCommonCssVarContent = (palette, common, fontSize) => {
    const paletteData = jsonToCssVar(palette, 'palette');
    const commonData = jsonToCssVar(palette, 'palette');
    const fontSizeData = jsonToCssVar(palette, 'palette');
    return {
        str: `
:root,:host{
/***************** 色板 *************************/
${paletteData.str}
/***************** 通用变量 **********************/
${commonData.str}
/***************** 字体 **********************/
${fontSizeData.str}
}
`,
        data: {
            ...paletteData.data,
            ...commonData.data,
            ...fontSizeData.data
        }
    }
}

/**
 * 组合组件变量
 * @param components
 * @returns
 */
const comboComponentCssVarContent = (components) => {
    let componentData = jsonToCssVar(components, 'both')
    return {
        str: `
:root,:host{
/***************** 组件 *************************/
${componentData.str}
}
`,
        data: {
            ...componentData.data
        }
    }
}


const genThemeFile = async (Theme) => {
    const ThemeNames = Object.keys(Theme);
    ThemeNames.forEach((name) => {
        const themeData = Theme[name]
        const ThemeName = name;
        const paletteJson = formatPaletteJsonToCssVarJson(themeData);
        const commonJson = formatCommonVarJsonToCssVarJson(themeData);
        const fontSizeJson = getFontSizeAndLineHeight(themeData)
        writePaletteFile(ThemeName, comboCommonCssVarContent(paletteJson, commonJson, fontSizeJson));
        const componentsJson = formatComponentVarJsonToCssVarJson(themeData);
        writeComponentFile(ThemeName, comboComponentCssVarContent(componentsJson));
    })

}

genThemeFile(Theme)
