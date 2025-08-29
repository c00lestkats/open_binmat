export default function (context: Context, args: BINMATArgs) {
    const suit_colors = {
        "%": "N",
        "+": "q",
        "&": "l",
        "^": "I",
        "!": "D",
        "#": "F"
    }

    if (!args || !args.s) {
        return (
            `
            \`UWelcome to https.binmat_recon!\`

\`UThis is a BINMAT brain script which shows you info you can't see in the BINMAT GUI.\`
\`UThe idea is that this supplements and extends the base GUI, not replacing it as a whole.\`

\`UUse this script like any other BINMAT brain not on your user.\`

\`DTHIS BRAIN DOES NOT PLAY BINMAT\`
`
        )
    }

    let s = args.s

    function getStackValue(stack: Stack | undefined) {
        let value = 0
        if (stack) {
            for (let i = 0; i < stack.length; i++) {
                const card: Card | `${Card}u` | "X" = stack[i];
                if (!["*", ">", "?", "@", "X"].includes(card[0])) {
                    if (card[0] == "a") {
                        value += 10
                    }
                    else {
                        value += Number(card[0])
                    }
                }
            }
        }

        return value
    }

    function getStackPower(stack: Stack | undefined) {
        let power = 0
        let wild = 0
        let val = getStackValue(stack)

        if (stack) {
            for (let i = 0; i < stack.length; i++) {
                const card = stack[i];
                if (card[0] == "*") { wild += 1 }
            }

            power = (val != 0 ? Math.log2(val) : 0)

            power += wild

            if (power % 1 != 0 && !wild) {
                power = 0
            }

        }

        return power - (power % 1)
    }

    let stacks: {
        a0: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        a1: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        a2: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        a3: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        a4: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        a5: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        d0: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        d1: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        d2: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        d3: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        d4: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        },
        d5: {
            contents: Stack,
            count: number,
            value: number,
            power: number
        }
    } = {
        a0: { contents: (s.a0 ? s.a0 : []), count: (s.a0 ? s.a0.length : 0), value: getStackValue(s.a0), power: getStackPower(s.a0) },
        a1: { contents: (s.a1 ? s.a1 : []), count: (s.a1 ? s.a1.length : 0), value: getStackValue(s.a1), power: getStackPower(s.a1) },
        a2: { contents: (s.a2 ? s.a2 : []), count: (s.a2 ? s.a2.length : 0), value: getStackValue(s.a2), power: getStackPower(s.a2) },
        a3: { contents: (s.a3 ? s.a3 : []), count: (s.a3 ? s.a3.length : 0), value: getStackValue(s.a3), power: getStackPower(s.a3) },
        a4: { contents: (s.a4 ? s.a4 : []), count: (s.a4 ? s.a4.length : 0), value: getStackValue(s.a4), power: getStackPower(s.a4) },
        a5: { contents: (s.a5 ? s.a5 : []), count: (s.a5 ? s.a5.length : 0), value: getStackValue(s.a5), power: getStackPower(s.a5) },
        d0: { contents: (s.d0 ? s.d0 : []), count: (s.d0 ? s.d0.length : 0), value: getStackValue(s.d0), power: getStackPower(s.d0) },
        d1: { contents: (s.d1 ? s.d1 : []), count: (s.d1 ? s.d1.length : 0), value: getStackValue(s.d1), power: getStackPower(s.d1) },
        d2: { contents: (s.d2 ? s.d2 : []), count: (s.d2 ? s.d2.length : 0), value: getStackValue(s.d2), power: getStackPower(s.d2) },
        d3: { contents: (s.d3 ? s.d3 : []), count: (s.d3 ? s.d3.length : 0), value: getStackValue(s.d3), power: getStackPower(s.d3) },
        d4: { contents: (s.d4 ? s.d4 : []), count: (s.d4 ? s.d4.length : 0), value: getStackValue(s.d4), power: getStackPower(s.d4) },
        d5: { contents: (s.d5 ? s.d5 : []), count: (s.d5 ? s.d5.length : 0), value: getStackValue(s.d5), power: getStackPower(s.d5) }
    }

    let csc = (c: Card | "X") => (c == "X" ? c : `\`${suit_colors[c[1]]}${c}\``)

    let sps = (s) => `\`${(s.power)}${s.value.toString().padStart(2, "0")} ${(s.power)}\``

    let dcs = (d) => `${(d ? d.c : "--").toString().padStart(2, "0")}`
    let dts = (d) => (d ? csc(d.t).padStart(2, " ") : "--")
    let xcs = (d) => `${(d ? d.length : "--").toString().padStart(2, "0")}`

    let out = (
        `
                \`U-- https.binmat_recon --\`


            \`ADECKS\`

    x0: ${xcs(s.x0)}  x1: ${xcs(s.x1)}  x2: ${xcs(s.x2)}  x3: ${xcs(s.x3)}  x4: ${xcs(s.x4)}  x5: ${xcs(s.x5)}
    \`${s.l0 ? "S" : "D"}l0\`: ${dcs(s.l0)}  \`${s.l1 ? "S" : "D"}l1\`: ${dcs(s.l1)}  \`${s.l2 ? "S" : "D"}l2\`: ${dcs(s.l2)}  \`${s.l3 ? "S" : "D"}l3\`: ${dcs(s.l3)}  \`${s.l4 ? "S" : "D"}l4\`: ${dcs(s.l4)}  \`${s.l5 ? "S" : "D"}l5\`: ${dcs(s.l5)}
    ${dts(s.l0)}      ${dts(s.l1)}      ${dts(s.l2)}      ${dts(s.l3)}      ${dts(s.l4)}      ${dts(s.l5)}

     a: ${dcs(s.a)}
    xa: ${xcs(s.xa)} ${(s.xa ? s.xa : []).map(csc).join(" ")}


            \`ASTACKS\`

        \`PDefender\`
${sps(stacks.d0)} \`Pd0\` ${stacks.d0.contents.map(csc).join(" ")}
${sps(stacks.d1)} \`Pd1\` ${stacks.d1.contents.map(csc).join(" ")}
${sps(stacks.d2)} \`Pd2\` ${stacks.d2.contents.map(csc).join(" ")}
${sps(stacks.d3)} \`Pd3\` ${stacks.d3.contents.map(csc).join(" ")}
${sps(stacks.d4)} \`Pd4\` ${stacks.d4.contents.map(csc).join(" ")}
${sps(stacks.d5)} \`Pd5\` ${stacks.d5.contents.map(csc).join(" ")}

        \`DAttacker\`
${sps(stacks.a0)} \`Da0\` ${stacks.a0.contents.map(csc).join(" ")}
${sps(stacks.a1)} \`Da1\` ${stacks.a1.contents.map(csc).join(" ")}
${sps(stacks.a2)} \`Da2\` ${stacks.a2.contents.map(csc).join(" ")}
${sps(stacks.a3)} \`Da3\` ${stacks.a3.contents.map(csc).join(" ")}
${sps(stacks.a4)} \`Da4\` ${stacks.a4.contents.map(csc).join(" ")}
${sps(stacks.a5)} \`Da5\` ${stacks.a5.contents.map(csc).join(" ")}

`
    )

    // $fs.chats.tell({ to: "southr6", msg: out })

    return out
}