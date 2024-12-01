"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import ReactFlow, {
  ConnectionMode,
  Edge,
  Node,
  Panel,
  Handle,
  Position,
  MarkerType,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { debug } from "@/lib/debug";
import React from "react";
import QueryProvider from "@/providers/query-provider";
import Link from "next/link";
import {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraphService,
} from "@/lib/graphService";

const CustomNode = React.memo(({ data }: { data: any }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow border">
      <Handle
        type="source"
        position={Position.Bottom}
        id={`${data.id}-source`}
        style={{ bottom: -5, opacity: 0 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id={`${data.id}-target`}
        style={{ top: -5, opacity: 0 }}
      />
      <p className="font-bold mb-2">{data.summary}</p>
      <div className="space-y-2">
        <div>
          <span className="text-sm text-gray-600">Index: </span>
          <span className="text-sm">{data.order_index}</span>
        </div>
        <div>
          <span className="text-sm text-gray-600">Content: </span>
          <span className="text-sm">{data.content}</span>
        </div>
        <div>
          <span className="text-sm text-gray-600">Supporting Quotes: </span>
          <div className="text-sm pl-2">
            {data.supporting_quotes.map((quote: string, i: number) => (
              <p key={i} className="italic">
                "{quote}"
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

const nodeTypes = {
  custom: CustomNode,
} as const;

// First, let's type the transformation functions
function toReactFlowNode(node: KnowledgeGraphNode): Node {
  return {
    id: node.id,
    type: "custom",
    data: node,
    position: { x: 0, y: 0 },
  };
}

function toReactFlowEdge(edge: KnowledgeGraphEdge): Edge {
  return {
    id: `${edge.parent_id}-${edge.child_id}`,
    source: edge.parent_id,
    target: edge.child_id,
    type: "default",
    animated: false,
    style: { strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 10,
      height: 10,
      color: "#374151",
    },
    sourceHandle: `${edge.parent_id}-source`,
    targetHandle: `${edge.child_id}-target`,
  };
}

// Then modify getLayoutedElements to use proper types
const getLayoutedElements = (
  knowledgeNodes: KnowledgeGraphNode[],
  knowledgeEdges: KnowledgeGraphEdge[],
  direction = "TB"
) => {
  const nodes: Node[] = knowledgeNodes.map(toReactFlowNode);
  const edges: Edge[] = knowledgeEdges.map(toReactFlowEdge);

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  // Set nodes
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 100 });
  });

  // Set edges
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Get positioned nodes
  const positionedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125, // center node
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: positionedNodes, edges };
};

function useGraph(graphId: string) {
  return useQuery({
    queryKey: ["graph", graphId],
    queryFn: () => KnowledgeGraphService.getGraph(graphId),
  });
}

export default function KnowledgeMap({ params }: { params: { id: string } }) {
  return (
    <QueryProvider>
      <KnowledgeMapContent params={Promise.resolve(params)} />
    </QueryProvider>
  );
}

function KnowledgeMapContent({ params }: { params: Promise<{ id: string }> }) {
  // START UNDELETABLE COMMENTS
  // VERY IMPORTANT: This is needed in the new React version:
  const unwrappedParams = React.use(params);
  // we CANNOT just use params.id because it's a Promise
  // do not change this OR the these comments
  // END UNDELETABLE COMMENTS
  const graphId = unwrappedParams.id;
  const { data: graph, isLoading } = useGraph(graphId);

  if (!graphId) {
    return <div>Invalid graph ID</div>;
  }

  if (isLoading) {
    return <div>Loading graph...</div>;
  }

  if (!graph) {
    return <div>Graph not found</div>;
  }

  const elements = getLayoutedElements(graph.nodes, graph.edges);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={elements.nodes}
        edges={elements.edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{
          type: "default",
          animated: false,
          style: { strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: "#374151",
          },
        }}
        fitView
      >
        <Panel position="top-left">
          <div className="bg-white p-4 rounded shadow">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">Knowledge Map</h2>
              <Link
                href="/dashboard"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
            <p className="text-sm text-gray-600 mt-2">Graph ID: {graphId}</p>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
