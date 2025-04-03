import React from "react";
import * as uuid from 'uuid';
import { TinyStore } from "../../utils/tiny";

const isWindow = typeof window !== 'undefined';

export const DEFAULT_MOBILE_WIDTH = 1024;

export interface Coord {
    x: number;
    y: number;
    centerX?: boolean;
}

export type FabPlacement = 'top left' | 'top right' | 'bottom right' | 'bottom left';
export type FabShape = 'round' | 'rounded square' | 'square' | 'pill';
export type FabSize = 'small' | 'medium' | 'large' | number;

/**
 * Default Fab Props
 */
export interface FabProps {
    placement: FabPlacement;
    shape: FabShape;
    size: FabSize;
    windowEdgeMinPadding?: Coord;
    boxStyle?: React.CSSProperties;
    children: JSX.Element;
}

/**
 * Default HoverStatState
 */
export interface FabState {
    touchToggled: boolean;
    boxStyle: React.CSSProperties;
}

/**
 * HoverStat abstract hover window class
 */
export class Fab extends React.Component<FabProps, FabState> {

    private _unmounted: boolean = false;
    private _nodismiss: boolean = false;

    protected _elems: HTMLElement[] | undefined = undefined;
    protected readonly observer = new MutationObserver((e) => { this.doWireup(); });

    protected readonly windowEdgeMinPadding: Coord;
    protected readonly divId = uuid.v4();

    protected hoverDelay = 400;

    constructor(props: FabProps) {
        super(props);
        this.windowEdgeMinPadding = props.windowEdgeMinPadding ?? { x: 16, y: 16 };

        this.state = {
            touchToggled: false,
            boxStyle: { position: "fixed", "display": "none", left: 0, top: 0, zIndex: -100, border: "1px solid gray", borderRadius: "8px", padding: "8px", ... this.props.boxStyle ?? {}} as React.CSSProperties
        } as FabState;
    }

    render() {
        const { boxStyle } = this.state;
        const { children } = this.props;
        const { divId } = this;
        const me = this;

        const containerOver = (e) => {
            if (me._unmounted) return;
        }

        const containerOut = (e) => {
            if (me._unmounted) return;
            this._nodismiss = false;
            //this.deactivate();
        }

        try {
            return (
                <div id={divId} onMouseOver={(e) => containerOver(e)} onMouseOut={(e) => containerOut(e)} className="ui segment" style={boxStyle}>
                    {children}
                </div>
            );

        }
        catch(err) {
            return (
                <div id={divId} onMouseOver={(e) => containerOver(e)} onMouseOut={(e) => containerOut(e)} className="ui segment" style={boxStyle}>
                   {err?.toString()}
                </div>
            );
        }
    }

    protected resizer = (e: any) => {
        this.forceUpdate();
    }

    protected getOffset(fromEl: HTMLElement) {
        let r = fromEl.getBoundingClientRect();
        return {
            top: r.y + window.scrollY,
            left: r.x + window.scrollX
        };
    }

    protected realignTarget = (hoverstat?: HTMLElement) => {
        const { divId } = this;
        const { placement, size, shape } = this.props;

        if (!hoverstat) return;
        let x = 0, y = 0;

        hoverstat.style.position = "fixed";
        hoverstat.style.display = "flex";
        hoverstat.style.opacity = "0";
        hoverstat.style.zIndex = "1009";

        if (isWindow) setTimeout(() => {
            let hoverstat = document.getElementById(divId);
            if (!hoverstat) return;

            let br = 0;
            let spx = 64;

            if (size === 'small') {
                spx = 32;
            }
            else if (size === 'medium') {
                spx = 64;
            }
            else if (size === 'large') {
                spx = 128;
            }
            else {
                spx = size;
            }

            if (shape === 'round') {
                br = Math.round(spx / 2);
            }
            else if (shape === 'rounded square') {
                br = 8;
            }
            else {
                br = 0;
            }

            let w = spx;
            let h = spx;

            if (shape !== 'pill') hoverstat.style.width = spx + "px";
            else hoverstat.style.width = 'auto';
            hoverstat.style.height = spx + "px";

            w = hoverstat.offsetWidth;
            h = hoverstat.offsetHeight;

            let pw = this.windowEdgeMinPadding?.x ?? 16;
            let ph = this.windowEdgeMinPadding?.y ?? 16;
            let vw = window.innerWidth;
            let vh = window.innerHeight;

            if (placement === 'bottom right') {
                x = vw - (w + pw);
                y = vh - (h + ph);
            }
            else if (placement === 'bottom left') {
                x = pw;
                y = vh - (h + ph);
            }
            else if (placement === 'top right') {
                x = vw - (w + pw);
                y = ph;
            }
            else if (placement === 'top left') {
                x = pw;
                y = ph;
            }

            hoverstat.style.left = x + "px";
            hoverstat.style.top = y + "px";
            hoverstat.style.borderRadius = br + "px";
            hoverstat.style.zIndex = "1009";

            hoverstat.style.opacity = "1";
            hoverstat.style.transition = "opacity 0.25s";
            if (isWindow) window.addEventListener("resize", this.resizer);
        }, this.hoverDelay)
    }

    protected activate = (): void => {
        const { divId } = this;
        let hoverstat = document.getElementById(divId);
        this._nodismiss = false;

        if (hoverstat) {
            setTimeout(() => this.realignTarget(hoverstat));
        }
    }

    protected deactivate = () => {
        if (isWindow) window.setTimeout(() => {
            const { divId } = this;
            // console.log("Deactivate " + divId);
            const hoverstat = document.getElementById(divId);
            if (hoverstat) {
                hoverstat.style.zIndex = "-100";
                hoverstat.style.opacity = "0";
                hoverstat.style.transition = "opacity 0.25s";

                if (isWindow) window.removeEventListener("resize", this.resizer);
                if (isWindow) window.setTimeout(() => hoverstat.style.display = "none", 0.25);
            }
        }, 0);
    }

    protected targetEnter = (e: MouseEvent) => {
    }

    protected targetLeave = (e: MouseEvent | TouchEvent) => {
    }

    protected touchTargetLeave = (e: MouseEvent | TouchEvent) => {
    }

    private touching?: boolean;

    protected touchEnd = (e: TouchEvent) => {
        this.touching = false;
    }

    protected touchStart = (e: TouchEvent) => {
        this.touching = true;
    };

    protected touchMove = (e: TouchEvent) => {
        this.touching = true;
    };

    protected onClick = (e: MouseEvent) => {
    }
    componentDidUpdate(prevProps: Readonly<FabProps>, prevState: Readonly<FabState>, snapshot?: any): void {
        this.activate();
    }
    componentDidMount(): void {
        this.doWireup();
        this.observer.observe(document, { subtree: true, childList: true });
    }

    doWireup(): void {
        var el = document.getElementById(this.divId);
        if (el) {

            let parent = el.parentElement as HTMLElement;
            let body = document.getElementsByTagName("BODY")[0];
            if (parent && parent !== body) {
                // parent.removeChild(el);
                // document.getElementsByTagName("BODY")[0].appendChild(el);
                el.addEventListener("mouseover", this.targetEnter);
                el.addEventListener("mouseout", this.targetLeave);
                el.addEventListener("touchend", this.touchEnd);
                el.addEventListener("touchstart", this.touchStart);
                el.addEventListener("touchmove", this.touchMove);
                el.addEventListener("mouseup", this.onClick);
            }

        }
    }

    componentWillUnmount(): void {
        this._unmounted = true;
        this.observer.disconnect();
        var el = document.getElementById(this.divId);
        if (el) {
            el.removeEventListener("mouseover", this.targetEnter);
            el.removeEventListener("mouseout", this.targetLeave);
            el.removeEventListener("touchend", this.touchEnd);
            el.removeEventListener("touchstart", this.touchStart);
            el.removeEventListener("touchmove", this.touchMove);
            el.removeEventListener("mouseup", this.onClick);
        }
    }
}

