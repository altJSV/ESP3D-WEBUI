/*
 filters.js - ESP3D WebUI helper file

 Copyright (c) 2020 Luc Lebosse. All rights reserved.

 This code is free software; you can redistribute it and/or
 modify it under the terms of the GNU Lesser General Public
 License as published by the Free Software Foundation; either
 version 2.1 of the License, or (at your option) any later version.

 This code is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public
 License along with This code; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/
import { h } from "preact"
import { useSettingsContextFn } from "../../../contexts"

/*
 * Local variables
 */
let wpos = []

////////////////////////////////////////////////////////
//
// Status format is : <...>

const isStatus = (str) => {
    const status_patern = /<?(.*)>/
    return status_patern.test(str)
}

const getStatus = (str) => {
    const res = {
        positions: {},
        status: {},
        ov: {},
        pn: {},
        a: {},
        ln: {},
        f: {},
        bf: {},
    }
    const mpos_pattern = /\|MPos:(?<mpos>[^\|>]+)/i
    const WCO_pattern = /\|WCO:(?<wco>[^\|>]+)/i
    const status_pattern = /<(?<state>[^:\|]+):*(?<code>[^\|:]*)\|/i
    const ov_patern = /\|Ov:(?<ov>[^\|>]+)/i
    const pn_patern = /\|Pn:(?<pn>[^\|>]+)/i
    const fs_patern = /\|Fs:(?<fs>[^\|>]+)/i
    const a_patern = /\|A:(?<a>[^\|>]+)/i
    const bf_patern = /\|Bf:(?<bf>[^\|>]+)/i
    const f_patern = /\|F:(?<f>[^\|>]+)/i
    const ln_patern = /\|Ln:(?<ln>[^\|>]+)/i
    let result = null
    //buffer state
    if ((result = bf_patern.exec(str)) !== null) {
        const r = result.groups.bf.split(",")
        res.bf.blocks = r[0]
        res.bf.bytes = r[1]
    }
    //line number
    if ((result = ln_patern.exec(str)) !== null) {
        res.ln.value = result.groups.ln
    }
    //feed rate and speed
    if ((result = fs_patern.exec(str)) !== null) {
        const r = result.groups.fs.split(",")
        res.f.value = r[0]
        res.f.rpm = r[1]
    }
    //feed rate
    if ((result = f_patern.exec(str)) !== null) {
        res.f.value = result.groups.f
    }
    //set each flag to a variable
    if ((result = a_patern.exec(str)) !== null) {
        res.a = result.groups.a.split("").reduce((acc, cur) => {
            acc[cur] = true
            return acc
        }, {})
    }
    //set each flag to a variable
    if ((result = pn_patern.exec(str)) !== null) {
        res.pn = result.groups.pn.split("").reduce((acc, cur) => {
            acc[cur] = true
            return acc
        }, {})
    }
    //extract status and optional message code
    if ((result = status_pattern.exec(str)) !== null) {
        res.status.state = result.groups.state
        res.status.code = result.groups.code
    }
    //extract override values
    if ((result = ov_patern.exec(str)) !== null) {
        const ov = result.groups.ov.split(",")
        res.ov = { speed: ov[0], feed: ov[1], spindle: ov[2] }
    }
    //extract positions
    if ((result = mpos_pattern.exec(str)) !== null) {
        try {
            const mpos_array = result.groups.mpos.split(",")
            const precision = mpos_array[0].split(".")[1].length
            const pos = mpos_array.map((e) =>
                parseFloat(e).toFixed(precision).toString()
            )

            //Work coordinates
            if ((result = WCO_pattern.exec(str)) !== null) {
                try {
                    const wpos_array = result.groups.wco.split(",")
                    wpos = wpos_array.map((e, index) =>
                        (parseFloat(pos[index]) - parseFloat(e))
                            .toFixed(precision)
                            .toString()
                    )
                } catch (e) {
                    console.error(e)
                }
            }
            res.positions = {
                x: pos[0],
                y: pos.length > 1 ? pos[1] : undefined,
                z: pos.length > 2 ? pos[2] : undefined,
                a: pos.length > 3 ? pos[3] : undefined,
                b: pos.length > 4 ? pos[4] : undefined,
                c: pos.length > 5 ? pos[5] : undefined,
                wx: wpos.length > 0 ? wpos[0] : undefined,
                wy: wpos.length > 1 ? wpos[1] : undefined,
                wz: wpos.length > 2 ? wpos[2] : undefined,
                wa: wpos.length > 3 ? wpos[3] : undefined,
                wb: wpos.length > 4 ? wpos[4] : undefined,
                wc: wpos.length > 5 ? wpos[5] : undefined,
            }
        } catch (e) {
            console.error(e)
        }
    }
    console.log(res)
    return res
}

////////////////////////////////////////////////////////
//
// States format is :  [GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F0.0 S0]

const isStates = (str) => {
    const reg_search = /\[GC:.*\]/g
    return reg_search.test(str)
}

const getStates = (str) => {
    let res = {}
    let result = null
    const reg_search = /\[GC:(?<states>.*)\]/g
    if ((result = reg_search.exec(str)) !== null) {
        res = result.groups.states.split(" ").reduce((acc, cur) => {
            if (
                cur.startsWith("F") ||
                cur.startsWith("S") ||
                cur.startsWith("T")
            ) {
                acc[
                    cur[0] == "F"
                        ? "feed_rate"
                        : cur[0] == "T"
                        ? "active_tool"
                        : "spindel_speed"
                ] = { value: parseFloat(cur.substring(1)) }
            } else {
                const gcode_parser_modes = [
                    {
                        id: "motion_mode",
                        values: [
                            "G0",
                            "G1",
                            "G2",
                            "G3",
                            "G38.2",
                            "G38.3",
                            "G38.4",
                            "G38.5",
                            "G80",
                        ],
                    },
                    {
                        id: "coordinate_system_select",
                        values: ["G54", "G55", "G56", "G57", "G58", "G59"],
                    },
                    { id: "plane_select", values: ["G17", "G18", "G19"] },
                    { id: "distance_mode", values: ["G90", "G91"] },
                    { id: "units", values: ["G20", "G21"] },
                    { id: "feed_rate_mode", values: ["G93", "G94"] },
                    { id: "arc_distance_mode", values: ["G91.1"] },
                    { id: "cutter_compensation_mode", values: ["G40"] },
                    { id: "tool_length_offset_mode", values: ["G43.1", "G49"] },
                    { id: "control_mode", values: ["M0", "M1", "M2", "M30"] },
                    { id: "spindle_mode", values: ["M3", "M4", "M5"] },
                    { id: "coolant_mode", values: ["M7", "M8", "M9"] },
                    { id: "override_control", values: ["M56"] },
                ]
                gcode_parser_modes.forEach((mode) => {
                    if (mode.values.includes(cur)) {
                        acc[mode.id] = { value: cur }
                    }
                })
            }
            return acc
        }, {})
    }
    console.log(res)
    return res
}

const isMessage = (str) => {
    return false
}

const getMessage = (str) => {
    return ""
}

const isSensor = (str) => {
    return str.startsWith("SENSOR:")
}

const getSensor = (str) => {
    const result = []
    const data = " " + str.substring(7)
    let res = null
    const reg_search = /\s(?<value>[^\[]+)\[(?<unit>[^\]]+)\]/g
    while ((res = reg_search.exec(data))) {
        if (res.groups) result.push(res.groups)
    }
    return result
}

export {
    isStatus,
    getStatus,
    isStates,
    getStates,
    isMessage,
    getMessage,
    isSensor,
    getSensor,
}