"use client";
import { useEffect, useState } from "react";
import ReactFlow, { Node, Edge, ConnectionMode, Panel } from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { debug } from "@/lib/debug";

// Custom node component
const CustomNode = ({ data }: { data: any }) => (
  <div className="bg-white p-4 rounded-lg shadow border">
    <h3 className="font-bold mb-2">{data.summary}</h3>
    <p className="text-sm">{data.content}</p>
    {data.supporting_quotes.length > 0 && (
      <div className="mt-2 text-xs text-gray-600">
        <p className="font-semibold">Supporting Quotes:</p>
        {data.supporting_quotes.map((quote: string, i: number) => (
          <p key={i} className="italic">
            "{quote}"
          </p>
        ))}
      </div>
    )}
  </div>
);

const nodeTypes = {
  custom: CustomNode,
};

// Layout helper function
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB"
) => {
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

export default function KnowledgeMap({ params }: { params: { id: string } }) {
  const [elements, setElements] = useState<{ nodes: Node[]; edges: Edge[] }>({
    nodes: [],
    edges: [],
  });

  useEffect(() => {
    const fetchMap = async () => {
      try {
        const response = await fetch(`/api/content_map/${params.id}`);
        if (!response.ok) throw new Error("Failed to fetch map");

        const data = await response.json();

        // Convert to ReactFlow format
        const nodes: Node[] = data.nodes.map((node: any) => ({
          id: node.id,
          type: "custom",
          data: node,
          position: { x: 0, y: 0 }, // Will be set by dagre
        }));

        const edges: Edge[] = data.edges.map((edge: any) => ({
          id: `${edge.parent_id}-${edge.child_id}`,
          source: edge.parent_id,
          target: edge.child_id,
          type: "smoothstep",
        }));

        // Apply layout
        const layoutedElements = getLayoutedElements(nodes, edges);
        setElements(layoutedElements);
      } catch (error) {
        debug.error("Error fetching knowledge map:", error);
      }
    };

    fetchMap();
  }, [params.id]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={elements.nodes}
        edges={elements.edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Panel position="top-left">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-bold mb-2">Knowledge Map</h2>
            <p className="text-sm text-gray-600">Document ID: {params.id}</p>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
